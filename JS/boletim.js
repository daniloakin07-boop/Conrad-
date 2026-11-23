/*
===============================================
JS/boletim.js
===============================================
Página: pages/boletim.html (perfil: aluno)
Finalidade: exibir o boletim individual do aluno — dados do aluno, média geral,
lista de atividades avaliativas com notas — e permitir salvar em PDF (impressão do navegador).

API usada: GET /api/boletim (rota em JS/medias.js; usa a sessão para saber quem é o aluno).
Resposta esperada: { aluno, salaVirtual, geradoEm, mediaGeral, totalAtividades, totalNotas,
  atividades[{ atividade, disciplina, turma, dataAplicacao, dataRealizada, nota, valorMaximo,
  notaEscala10 }], vinculoSalaDetectado, dataRealizadaDisponivel }.

Observação: este arquivo usa fetch() direto (e não conradFetch), portanto depende de a página
ser servida pela mesma origem do servidor Express (caminho relativo "/api/boletim").
*/

// Referências aos elementos da página (ids definidos em pages/boletim.html)
const elementosBoletim = {
    status: document.getElementById("mensagemStatus"),
    nome: document.getElementById("nomeAluno"),
    turma: document.getElementById("turmaAluno"),
    emissao: document.getElementById("dataEmissao"),
    media: document.getElementById("mediaGeral"),
    totalAtividades: document.getElementById("totalAtividades"),
    totalNotas: document.getElementById("totalNotas"),
    ultimaAtividade: document.getElementById("ultimaAtividade"),
    corpoTabela: document.getElementById("corpoTabelaAtividades"),
    avisos: document.getElementById("avisosBoletim"),
    rodapeData: document.getElementById("rodapeData"),
    botaoPdf: document.getElementById("btnSalvarPdf")
};

// Mostra uma mensagem de status no topo; `tipo` vira classe CSS ("sucesso" ou "erro").
function definirStatus(mensagem, tipo = "") {
    elementosBoletim.status.textContent = mensagem;
    elementosBoletim.status.className = `mensagem-status ${tipo}`.trim();
}

// Formata número com 2 casas no padrão brasileiro (8,50). Valores vazios/inválidos viram "—".
function formatarNumero(valor) {
    if (valor === null || valor === undefined || valor === "" || !Number.isFinite(Number(valor))) {
        return "—";
    }
    return Number(valor).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

/**
 * Converte datas ISO ('AAAA-MM-DD' ou com hora) para 'DD/MM/AAAA' (e 'às HH:MM' se pedido).
 * Faz a conversão por texto (regex) para não sofrer deslocamento de fuso horário.
 */
function formatarData(valor, incluirHora = false) {
    if (!valor) return "Não registrada";

    const texto = String(valor);
    const correspondencia = texto.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
    if (correspondencia) {
        const data = `${correspondencia[3]}/${correspondencia[2]}/${correspondencia[1]}`;
        if (incluirHora && correspondencia[4] && correspondencia[5]) {
            return `${data} às ${correspondencia[4]}:${correspondencia[5]}`;
        }
        return data;
    }

    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return texto;
    return new Intl.DateTimeFormat("pt-BR").format(data);
}

// Cria uma <td> com textContent (valor vazio vira "—") e anexa à linha da tabela
function adicionarCelula(linha, conteudo, classe = "") {
    const celula = document.createElement("td");
    celula.textContent = conteudo === null || conteudo === undefined || conteudo === "" ? "—" : String(conteudo);
    if (classe) celula.className = classe;
    linha.appendChild(celula);
    return celula;
}

// Acrescenta um parágrafo de aviso explicativo abaixo do boletim
function adicionarAviso(texto, tipo = "") {
    const aviso = document.createElement("p");
    aviso.className = `aviso-boletim ${tipo}`.trim();
    aviso.textContent = texto;
    elementosBoletim.avisos.appendChild(aviso);
}

/**
 * Desenha as linhas da tabela de atividades (8 colunas). Sem atividades, mostra uma linha vazia.
 * A coluna "Nota (0-10)" usa notaEscala10, calculada pelo servidor.
 */
function renderizarAtividades(atividades) {
    elementosBoletim.corpoTabela.replaceChildren();

    if (!Array.isArray(atividades) || atividades.length === 0) {
        const linha = document.createElement("tr");
        const celula = document.createElement("td");
        celula.colSpan = 8;
        celula.className = "linha-vazia";
        celula.textContent = "Nenhuma atividade avaliativa foi encontrada para os dados disponíveis.";
        linha.appendChild(celula);
        elementosBoletim.corpoTabela.appendChild(linha);
        return;
    }

    atividades.forEach((atividade) => {
        const linha = document.createElement("tr");
        adicionarCelula(linha, atividade.atividade || "Atividade sem título");
        adicionarCelula(linha, atividade.disciplina || "Não informada");
        adicionarCelula(linha, atividade.turma || "Não identificada");
        adicionarCelula(linha, formatarData(atividade.dataAplicacao));
        adicionarCelula(linha, formatarData(atividade.dataRealizada));

        const notaObtida = atividade.nota === null || atividade.nota === undefined
            ? "Sem nota"
            : `${formatarNumero(atividade.nota)} / ${formatarNumero(atividade.valorMaximo)}`;
        adicionarCelula(linha, notaObtida);
        adicionarCelula(
            linha,
            atividade.notaEscala10 === null || atividade.notaEscala10 === undefined
                ? "—"
                : formatarNumero(atividade.notaEscala10),
            "nota-destaque"
        );

        const celulaStatus = adicionarCelula(linha, "");
        const etiqueta = document.createElement("span");
        const temNota = atividade.nota !== null && atividade.nota !== undefined;
        etiqueta.className = `status-nota ${temNota ? "" : "pendente"}`.trim();
        etiqueta.textContent = temNota ? "Nota lançada" : "Aguardando nota";
        celulaStatus.replaceChildren(etiqueta);
        elementosBoletim.corpoTabela.appendChild(linha);
    });
}

/**
 * Preenche cabeçalho, indicadores (média, totais, última atividade), tabela e avisos.
 * Os avisos informam limitações de dados (sem turma vinculada, sem data de realização, sem notas).
 */
function preencherBoletim(dados) {
    const aluno = dados.aluno || {};
    elementosBoletim.nome.textContent = aluno.nome || "Estudante";
    elementosBoletim.turma.textContent = dados.salaVirtual || "Não identificada";
    elementosBoletim.emissao.textContent = formatarData(dados.geradoEm);
    elementosBoletim.media.textContent = dados.mediaGeral === null || dados.mediaGeral === undefined
        ? "—"
        : formatarNumero(dados.mediaGeral);
    elementosBoletim.totalAtividades.textContent = String(dados.totalAtividades ?? 0);
    elementosBoletim.totalNotas.textContent = String(dados.totalNotas ?? 0);

    const atividades = Array.isArray(dados.atividades) ? dados.atividades : [];
    const datasAplicacao = atividades
        .map(item => item.dataAplicacao)
        .filter(Boolean)
        .map(item => String(item).slice(0, 10))
        .sort();
    elementosBoletim.ultimaAtividade.textContent = datasAplicacao.length
        ? formatarData(datasAplicacao[datasAplicacao.length - 1])
        : "—";

    elementosBoletim.rodapeData.textContent = `Emitido em ${formatarData(dados.geradoEm)}`;
    renderizarAtividades(atividades);
    elementosBoletim.avisos.replaceChildren();

    if (!dados.vinculoSalaDetectado) {
        adicionarAviso(
            "O cadastro atual não possui um vínculo direto com uma turma no banco de dados. Neste caso, o boletim lista somente as atividades avaliativas que já têm uma nota associada ao seu usuário; atividades sem nota podem não aparecer.",
            "info"
        );
    }

    if (!dados.dataRealizadaDisponivel) {
        adicionarAviso(
            "O banco de dados não possui um campo reconhecido para registrar a data de realização/envio da atividade. Por isso, esta coluna mostra “Não registrada” até que essa informação seja armazenada. A data de aplicação é exibida separadamente.",
            "info"
        );
    }

    if (dados.totalNotas === 0) {
        adicionarAviso("Ainda não há notas lançadas para calcular a média individual.", "info");
    }

    document.title = `Boletim de ${aluno.nome || "estudante"} | CONRAD Virtual School`;
    definirStatus("Boletim carregado com os dados disponíveis.", "sucesso");
}

// Busca o boletim no servidor. 401 -> login; outros erros aparecem no status e na tabela.
async function carregarBoletim() {
    try {
        const resposta = await fetch("/api/boletim", {
            method: "GET",
            credentials: "include",
            headers: { "Accept": "application/json" }
        });

        const dados = await resposta.json().catch(() => ({}));

        if (resposta.status === 401) {
            window.location.href = "login.html";
            return;
        }

        if (!resposta.ok) {
            throw new Error(dados.erro || "Não foi possível carregar o boletim.");
        }

        preencherBoletim(dados);
    } catch (erro) {
        console.error("Erro ao carregar boletim:", erro);
        definirStatus(
            erro.message || "Erro ao carregar as notas. Acesse a página pelo servidor CONRAD e tente novamente.",
            "erro"
        );
        elementosBoletim.corpoTabela.replaceChildren();
        const linha = document.createElement("tr");
        const celula = document.createElement("td");
        celula.colSpan = 8;
        celula.className = "linha-vazia";
        celula.textContent = "Não foi possível buscar os dados do boletim.";
        linha.appendChild(celula);
        elementosBoletim.corpoTabela.appendChild(linha);
    }
}

// "Salvar PDF": usa a impressão do navegador (o CSS de impressão esconde menus e botões)
elementosBoletim.botaoPdf.addEventListener("click", () => {
    window.print();
});

// Inicia o carregamento assim que o script é executado (carregado com defer)
carregarBoletim();
