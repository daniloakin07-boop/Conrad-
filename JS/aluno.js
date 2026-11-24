/*
===============================================
JS/aluno.js
===============================================
Painel do aluno: consulta a sessão e os conteúdos publicados nas turmas em que
está matriculado. A frequência considera as entregas de atividades e avaliações;
o desempenho considera exclusivamente as avaliações dessas turmas.

API: GET /me, GET /api/aluno/atividades e GET /api/turmas.
*/

const listaTarefas = document.getElementById("listaTarefas");
const contadorTarefas = document.getElementById("contadorTarefas");

// O checklist só é inicializado quando os elementos existem nesta página.
if (listaTarefas && contadorTarefas) {
    listaTarefas.addEventListener("change", (evento) => {
        if (evento.target.type !== "checkbox") return;
        evento.target.closest("li")?.classList.toggle("feita", evento.target.checked);
        contadorTarefas.textContent = listaTarefas.querySelectorAll('input:not(:checked)').length;
    });
}

(async function iniciarPainelAluno() {
    // Cria elementos e insere textos por textContent, sem interpretar dados do banco como HTML.
    const h = (tag, classe, texto) => {
        const elemento = document.createElement(tag);
        if (classe) elemento.className = classe;
        if (texto !== undefined && texto !== null) elemento.textContent = texto;
        return elemento;
    };

    function saudacao() {
        const hora = new Date().getHours();
        return hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
    }

    function iniciais(nome) {
        const partes = String(nome || "").trim().split(/\s+/).filter(Boolean);
        if (!partes.length) return "A";
        return (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase();
    }

    function preencherNome(nome) {
        const titulo = document.querySelector(".titulo-dashboard h1");
        if (titulo) titulo.textContent = saudacao() + ", " + nome;

        // Atualiza somente o bloco de usuário; não altera o título da área de suporte.
        document.querySelectorAll(".menu-lateral .menu-perfil > strong, .profile-name strong")
            .forEach((elemento) => { elemento.textContent = nome; });

        const avatar = document.querySelector(".header-profile .avatar");
        if (avatar) avatar.textContent = iniciais(nome);
    }

    document.querySelectorAll("[data-sair]").forEach((link) => {
        link.addEventListener("click", (evento) => {
            evento.preventDefault();
            conradFetch("/logout", { method: "POST" })
                .finally(() => { location.href = "../index.html"; });
        });
    });

    function dataISO(data) {
        return data.getFullYear() + "-" +
            String(data.getMonth() + 1).padStart(2, "0") + "-" +
            String(data.getDate()).padStart(2, "0");
    }

    function dataBR(valor) {
        if (!valor) return "Sem prazo";
        const partes = String(valor).slice(0, 10).split("-");
        return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : String(valor);
    }

    function normalizarNome(valor) {
        return String(valor || "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
    }

    const parametros = new URLSearchParams(location.search);
    const turmaId = parametros.get("turmaId");
    const filtroTurma = turmaId ? "?turmaId=" + encodeURIComponent(turmaId) : "";

    function ajustarParaTurma(nomeTurma) {
        const id = encodeURIComponent(turmaId);
        const verAtividades = document.querySelector('.quick-actions a[href^="aluno-atividades"]');
        const salaVideo = document.querySelector('.quick-actions a[href^="salas"]');
        if (verAtividades) verAtividades.href = "aluno-atividades.html?turmaId=" + id;
        if (salaVideo) salaVideo.href = "turma.html?id=" + id + "&aba=video";

        const acoes = document.querySelector(".quick-actions");
        if (acoes && !acoes.querySelector('a[href^="turma.html?id="]')) {
            const abrirTurma = h("a", "btn-secundario", "Abrir turma");
            abrirTurma.href = "turma.html?id=" + id;
            acoes.append(abrirTurma);
        }

        const subtitulo = document.querySelector(".titulo-dashboard p");
        if (subtitulo) subtitulo.textContent =
            "Turma: " + (nomeTurma || "selecionada") + " — resumo das entregas e avaliações";
    }

    function itensPublicados(atividades) {
        return (Array.isArray(atividades) ? atividades : []).filter((atividade) =>
            ["atividade", "avaliacao"].includes(String(atividade.tipo || "").toLocaleLowerCase("pt-BR"))
        );
    }

    function obterPercentual(itens) {
        if (!itens.length) return null;
        const entregues = itens.filter((item) => Boolean(item.enviada_em)).length;
        return Math.round((entregues / itens.length) * 100);
    }

    // Exibe a frequência geral e também a situação individual de cada turma.
    // Uma turma sem conteúdo publicado recebe null (apresentado como —), sem ser
    // tratada como 0% ou adicionada artificialmente ao denominador geral.
    function atualizarFrequencia(itens, turmas) {
        const anel = document.querySelector(".al-anel");
        const valorAnel = anel?.querySelector("span");
        const informacoes = document.querySelector(".al-freq-info");
        const rotulo = document.querySelector(".al-freq-topo > span");
        const cartoes = document.querySelectorAll(".cards-resumo .card-resumo");

        const total = itens.length;
        const entregues = itens.filter((item) => Boolean(item.enviada_em)).length;
        const percentual = obterPercentual(itens);

        if (rotulo) rotulo.textContent = "Entregas nas turmas";
        if (anel) anel.style.setProperty("--valor", String(percentual ?? 0));
        if (valorAnel) valorAnel.textContent = percentual === null ? "—" : percentual + "%";

        // O segundo cartão do painel apresenta o mesmo indicador resumido.
        if (cartoes[1]) {
            const numero = cartoes[1].querySelector("h2");
            const titulo = cartoes[1].querySelector("h3");
            const descricao = cartoes[1].querySelector("span");
            if (numero) numero.textContent = percentual === null ? "—" : percentual + "%";
            if (titulo) titulo.textContent = "Frequência";
            if (descricao) descricao.textContent = total
                ? `${entregues} de ${total} entregas enviadas`
                : "Sem atividades ou avaliações publicadas";
        }

        if (!informacoes) return;
        informacoes.replaceChildren();

        if (percentual === null) {
            informacoes.append(
                h("h3", "", "Sem dados de frequência"),
                h("p", "", "Nenhuma atividade ou avaliação foi publicada nas suas turmas.")
            );
        } else {
            informacoes.append(
                h("h3", "", `${entregues} de ${total} entrega(s) realizada(s)`),
                h("p", "", `Percentual de entregas: ${percentual}%`)
            );
        }

        const turmasValidas = Array.isArray(turmas) ? turmas : [];
        const itensAssociados = new Set();

        turmasValidas.forEach((turma) => {
            const itensDaTurma = itens.filter((item) => {
                if (item.turma_id !== null && item.turma_id !== undefined) {
                    return String(item.turma_id) === String(turma.id);
                }
                return normalizarNome(item.turma) === normalizarNome(turma.nome);
            });
            itensDaTurma.forEach((item) => itensAssociados.add(item));

            const nome = turma.nome || "Turma";
            if (!itensDaTurma.length) {
                informacoes.append(h("p", "al-freq-turma", `${nome}: — · Sem atividade ou avaliação publicada`));
            } else {
                const enviados = itensDaTurma.filter((item) => Boolean(item.enviada_em)).length;
                const taxa = obterPercentual(itensDaTurma);
                informacoes.append(h("p", "al-freq-turma", `${nome}: ${taxa}% · ${enviados}/${itensDaTurma.length} entregas`));
            }
        });

        // Compatibilidade com conteúdos antigos que ainda não possuem turma_id
        // ou com dados cuja turma não veio na lista atual de matrículas.
        const itensSemTurmaAssociada = itens.filter((item) => !itensAssociados.has(item));
        if (itensSemTurmaAssociada.length) {
            const grupos = new Map();
            itensSemTurmaAssociada.forEach((item) => {
                const chave = item.turma_id != null
                    ? "id:" + item.turma_id
                    : "nome:" + normalizarNome(item.turma || "Turma não identificada");
                if (!grupos.has(chave)) grupos.set(chave, { nome: item.turma || "Turma não identificada", itens: [] });
                grupos.get(chave).itens.push(item);
            });
            grupos.forEach((grupo) => {
                const enviados = grupo.itens.filter((item) => Boolean(item.enviada_em)).length;
                const taxa = obterPercentual(grupo.itens);
                informacoes.append(h("p", "al-freq-turma", `${grupo.nome}: ${taxa}% · ${enviados}/${grupo.itens.length} entregas`));
            });
        }

        if (!turmasValidas.length && !total) {
            informacoes.append(h("p", "al-freq-turma", "Nenhuma turma vinculada no momento."));
        }
    }

    // O desempenho lista somente avaliações efetivamente publicadas nas turmas do aluno.
    function renderizarDesempenho(avaliacoes) {
        const lista = document.querySelector(".lista-desempenho-aluno");
        if (!lista) return;
        lista.replaceChildren();

        if (!avaliacoes.length) {
            lista.append(h("p", "al-desempenho-vazio", "Nenhuma avaliação foi publicada nas suas turmas."));
            return;
        }

        avaliacoes.forEach((avaliacao) => {
            const linha = h("div", "aluno");
            const detalhes = h("div");
            const meta = [avaliacao.disciplina, avaliacao.turma].filter(Boolean).join(" · ");
            detalhes.append(
                h("strong", "", avaliacao.titulo || "Avaliação"),
                h("small", "", meta || "Avaliação da turma")
            );

            const temNota = avaliacao.nota !== null && avaliacao.nota !== undefined &&
                Number.isFinite(Number(avaliacao.nota)) && Number(avaliacao.valor_maximo) > 0;
            const nota = temNota
                ? `${Number(avaliacao.nota).toLocaleString("pt-BR")} / ${Number(avaliacao.valor_maximo).toLocaleString("pt-BR")}`
                : "—";
            const corrigida = Boolean(avaliacao.corrigida_em);
            const status = corrigida
                ? "Corrigida"
                : avaliacao.enviada_em ? "Enviada · aguardando correção" : "Pendente";

            linha.append(
                detalhes,
                h("strong", "nota-avaliacao", nota),
                h("div", "status " + (corrigida ? "ativo" : "pendente"), status)
            );
            lista.append(linha);
        });
    }

    try {
        const sessao = await conradFetch("/me");
        if (sessao.usuario?.tipo === "educador") {
            location.href = "educador.html";
            return;
        }
        preencherNome(sessao.usuario?.nome || "Estudante");

        // O conteúdo e as turmas vêm do usuário autenticado; nenhuma informação é fixa no HTML.
        const [dadosAtividades, dadosTurmas] = await Promise.all([
            conradFetch("/api/aluno/atividades" + filtroTurma),
            conradFetch("/api/turmas").catch((erro) => {
                console.warn("Não foi possível carregar a lista de turmas para detalhar a frequência:", erro);
                return { turmas: [] };
            })
        ]);

        if (turmaId) ajustarParaTurma(dadosAtividades.turma);

        const publicados = itensPublicados(dadosAtividades.atividades);
        const avaliacoes = publicados.filter((item) =>
            String(item.tipo || "").toLocaleLowerCase("pt-BR") === "avaliacao"
        );
        const turmasDisponiveis = Array.isArray(dadosTurmas.turmas) ? dadosTurmas.turmas : [];
        // Quando o painel foi aberto com ?turmaId, a frequência detalhada deve mostrar
        // somente a turma selecionada, pois a consulta de atividades também está filtrada.
        const turmas = turmaId
            ? turmasDisponiveis.filter((turma) => String(turma.id) === String(turmaId))
            : turmasDisponiveis;
        const cartoes = document.querySelectorAll(".cards-resumo .card-resumo");

        // Média calculada exclusivamente com notas de avaliações corrigidas.
        const notas = avaliacoes
            .filter((item) => item.nota !== null && item.nota !== undefined &&
                Number(item.valor_maximo) > 0 && Number.isFinite(Number(item.nota)))
            .map((item) => Number(item.nota) / Number(item.valor_maximo) * 10);

        if (cartoes[0]) {
            const numero = cartoes[0].querySelector("h2");
            const titulo = cartoes[0].querySelector("h3");
            const descricao = cartoes[0].querySelector("span");
            if (numero) numero.textContent = notas.length
                ? (notas.reduce((soma, nota) => soma + nota, 0) / notas.length).toFixed(1).replace(".", ",")
                : "—";
            if (titulo) titulo.textContent = "Média das avaliações";
            if (descricao) descricao.textContent = notas.length
                ? `Média de ${notas.length} avaliação(ões) corrigida(s)`
                : avaliacoes.length
                    ? "Ainda não há avaliações corrigidas"
                    : "Nenhuma avaliação publicada nas suas turmas";
        }

        atualizarFrequencia(publicados, turmas);
        renderizarDesempenho(avaliacoes);

        // Pendências incluem atividades e avaliações ainda não enviadas.
        const pendentes = publicados.filter((item) => !item.enviada_em);
        const contador = document.getElementById("contadorTarefas");
        if (cartoes[2]?.querySelector("h2")) cartoes[2].querySelector("h2").textContent = pendentes.length;
        if (contador) contador.textContent = pendentes.length;
        if (!listaTarefas) return;

        listaTarefas.replaceChildren();
        const amanha = dataISO(new Date(Date.now() + 86400000));
        if (!pendentes.length) {
            const vazio = h("li");
            vazio.append(h("p", "al-tarefa-titulo", "Nenhuma tarefa pendente 🎉"));
            listaTarefas.append(vazio);
        }

        pendentes.forEach((atividade) => {
            const item = h("li");
            item.style.cursor = "pointer";
            item.addEventListener("click", (evento) => {
                if (evento.target.closest("a, button, input, textarea")) return;
                location.href = "aluno-atividades.html" +
                    (turmaId ? "?turmaId=" + encodeURIComponent(turmaId) : "");
            });

            const urgente = atividade.data_aplicacao && String(atividade.data_aplicacao).slice(0, 10) <= amanha;
            const caixa = h("div");
            caixa.append(
                h("p", "al-tarefa-titulo", atividade.titulo || "Atividade"),
                h("p", "al-tarefa-meta" + (urgente ? " urgente" : ""),
                    (atividade.disciplina || "Turma") + " · " +
                    (atividade.tipo === "avaliacao" ? "Avaliação" : "Atividade") +
                    (atividade.data_aplicacao ? " · Prazo " + dataBR(atividade.data_aplicacao) : ""))
            );
            item.append(caixa);
            listaTarefas.append(item);
        });
    } catch (erro) {
        if (erro.status === 401) location.href = "login.html";
        else if (erro.status === 403 && turmaId) location.href = "turmas.html";
        else {
            console.error("Erro ao carregar o painel do aluno:", erro);
            const lista = document.querySelector(".lista-desempenho-aluno");
            if (lista) lista.replaceChildren(h("p", "al-desempenho-vazio", "Não foi possível carregar suas avaliações."));

            const anel = document.querySelector(".al-anel");
            const valorAnel = anel?.querySelector("span");
            if (anel) anel.style.setProperty("--valor", "0");
            if (valorAnel) valorAnel.textContent = "—";

            const informacoes = document.querySelector(".al-freq-info");
            if (informacoes) {
                informacoes.replaceChildren(
                    h("h3", "", "Frequência indisponível"),
                    h("p", "", "Não foi possível consultar as entregas das suas turmas. Atualize a página para tentar novamente.")
                );
            }

            const cartaoFrequencia = document.querySelectorAll(".cards-resumo .card-resumo")[1];
            if (cartaoFrequencia?.querySelector("span")) {
                cartaoFrequencia.querySelector("span").textContent = "Não foi possível consultar as entregas";
            }
        }
    }
})();
