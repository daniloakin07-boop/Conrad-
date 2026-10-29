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

function definirStatus(mensagem, tipo = "") {
    elementosBoletim.status.textContent = mensagem;
    elementosBoletim.status.className = `mensagem-status ${tipo}`.trim();
}

function formatarNumero(valor) {
    if (valor === null || valor === undefined || valor === "" || !Number.isFinite(Number(valor))) {
        return "—";
    }
    return Number(valor).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

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

function adicionarCelula(linha, conteudo, classe = "") {
    const celula = document.createElement("td");
    celula.textContent = conteudo === null || conteudo === undefined || conteudo === "" ? "—" : String(conteudo);
    if (classe) celula.className = classe;
    linha.appendChild(celula);
    return celula;
}

function adicionarAviso(texto, tipo = "") {
    const aviso = document.createElement("p");
    aviso.className = `aviso-boletim ${tipo}`.trim();
    aviso.textContent = texto;
    elementosBoletim.avisos.appendChild(aviso);
}

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
            "O cadastro atual não possui um vínculo explícito com uma sala virtual no banco de dados. Neste caso, o boletim lista somente as atividades avaliativas que já têm uma nota associada ao seu usuário; atividades sem nota podem não aparecer.",
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

elementosBoletim.botaoPdf.addEventListener("click", () => {
    window.print();
});

carregarBoletim();
