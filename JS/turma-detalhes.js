(function () {
    const $ = (seletor) => document.querySelector(seletor);
    const params = new URLSearchParams(location.search);
    const turmaId = Number(params.get("id"));
    const painel = $("#turma-painel");
    let dadosTurma = null;
    let usuarioAtual = null;
    let jitsiApi = null;
    let jitsiRenderToken = 0;
    let abaAtual = params.get("aba") || "mural";

    function criar(tag, classe, texto) {
        const elemento = document.createElement(tag);
        if (classe) elemento.className = classe;
        if (texto !== undefined && texto !== null) elemento.textContent = texto;
        return elemento;
    }

    function dataBR(data) {
        if (!data) return "Sem prazo definido";
        const partes = String(data).slice(0, 10).split("-");
        return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : data;
    }

    function link(texto, href, classe = "btn-turma btn-outline") {
        const a = criar("a", classe, texto);
        a.href = href;
        a.style.textDecoration = "none";
        if (href.startsWith("https://")) {
            a.target = "_blank";
            a.rel = "noopener noreferrer";
        }
        return a;
    }

    function listaVazia(texto) {
        painel.replaceChildren(criar("p", "turmas-vazio", texto));
    }

    function carregarApiJitsi() {
        return new Promise((resolve, reject) => {
            if (window.JitsiMeetExternalAPI) return resolve();

            let script = document.querySelector('script[data-jitsi-api="true"]');
            if (script?.dataset.failed === "true") {
                script.remove();
                script = null;
            }
            if (!script) {
                script = document.createElement("script");
                script.src = "https://meet.jit.si/external_api.js";
                script.async = true;
                script.dataset.jitsiApi = "true";
            }
            if (script.dataset.loaded === "true") return resolve();

            script.addEventListener("load", () => {
                script.dataset.loaded = "true";
                resolve();
            }, { once: true });
            script.addEventListener("error", () => {
                script.dataset.failed = "true";
                reject(new Error("Não foi possível carregar a ferramenta de vídeo."));
            }, { once: true });
            if (!script.isConnected) document.head.append(script);
        });
    }

    function montarCartao(titulo, descricao) {
        const card = criar("article", "turma-painel-card");
        card.append(criar("h2", "", titulo));
        if (descricao) card.append(criar("p", "", descricao));
        return card;
    }

    function atualizarAba() {
        document.querySelectorAll("[data-aba]").forEach((botao) => {
            botao.classList.toggle("ativa", botao.dataset.aba === abaAtual);
        });
    }

    async function buscarConteudos(tipo) {
        const professor = dadosTurma.papel === "educador";
        const base = professor ? "/api/atividades" : "/api/aluno/atividades";
        const query = new URLSearchParams({ turmaId: String(turmaId), tipo });
        return conradFetch(`${base}?${query.toString()}`);
    }

    function botoesConteudo(tipo) {
        const acoes = criar("div", "turma-atalhos");
        if (dadosTurma.papel === "educador") {
            const novo = tipo === "avaliacao" ? "nova-avaliacao.html" : "nova-atividade.html";
            const rotulo = tipo === "avaliacao" ? "+ Criar avaliação" : "+ Criar atividade";
            acoes.append(link(rotulo, `${novo}?turmaId=${turmaId}`, "btn-turma btn-primary"));
            acoes.append(link("Ver entregas e correções", `professor-correcao.html?turmaId=${turmaId}&tipo=${tipo}`));
        } else {
            acoes.append(link(tipo === "avaliacao" ? "Abrir avaliações" : "Abrir atividades", `aluno-atividades.html?turmaId=${turmaId}&tipo=${tipo}`, "btn-turma btn-primary"));
        }
        return acoes;
    }

    async function renderizarConteudos(tipo) {
        painel.replaceChildren(criar("p", "turmas-vazio", "Carregando conteúdo..."));
        try {
            const lista = await buscarConteudos(tipo);
            const itens = Array.isArray(lista) ? lista : lista.atividades || [];
            const card = montarCartao(tipo === "avaliacao" ? "Avaliações da turma" : "Atividades da turma",
                tipo === "avaliacao"
                    ? "Provas, trabalhos avaliativos e pontuações desta turma."
                    : "Tarefas, prazos e entregas organizados para os alunos desta turma.");
            card.append(botoesConteudo(tipo));

            if (!itens.length) {
                card.append(criar("p", "turmas-vazio", tipo === "avaliacao"
                    ? "Nenhuma avaliação foi publicada nesta turma ainda."
                    : "Nenhuma atividade foi publicada nesta turma ainda."));
            } else {
                itens.forEach((item) => {
                    const linha = criar("div", "turma-lista-item");
                    const info = criar("div");
                    info.append(
                        criar("strong", "", item.titulo),
                        criar("small", "", `${item.disciplina} • Prazo: ${dataBR(item.data_aplicacao)} • ${Number(item.valor_maximo)} pontos`)
                    );
                    if (dadosTurma.papel === "educador") {
                        linha.append(info, criar("small", "", `${item.total_entregas || 0} entrega(s)`));
                    } else {
                        const status = item.corrigida_em ? `Nota: ${item.nota ?? "—"}` : item.enviada_em ? "Enviada" : "Pendente";
                        linha.append(info, criar("small", "", status));
                    }
                    card.append(linha);
                });
            }
            painel.replaceChildren(card);
        } catch (erro) {
            listaVazia(erro.message);
        }
    }

    async function renderizarMural() {
        painel.replaceChildren(criar("p", "turmas-vazio", "Carregando mural..."));
        try {
            const [atividades, avaliacoes] = await Promise.all([
                buscarConteudos("atividade"), buscarConteudos("avaliacao")
            ]);
            const qtdAtividades = (Array.isArray(atividades) ? atividades : atividades.atividades || []).length;
            const qtdAvaliacoes = (Array.isArray(avaliacoes) ? avaliacoes : avaliacoes.atividades || []).length;
            const resumo = montarCartao("Bem-vindo à sua turma", dadosTurma.descricao || "Aqui ficam reunidos os conteúdos, as atividades e os encontros desta sala.");
            const grade = criar("div", "turma-resumo-grid");
            [
                [dadosTurma.quantidade_alunos, "Alunos matriculados"],
                [qtdAtividades, "Atividades publicadas"],
                [qtdAvaliacoes, "Avaliações publicadas"]
            ].forEach(([valor, texto]) => {
                const item = criar("div", "turma-resumo-item");
                item.append(criar("strong", "", String(valor ?? 0)), criar("span", "", texto));
                grade.append(item);
            });
            resumo.append(grade);

            const atalhos = criar("div", "turma-atalhos");
            [
                ["Ver atividades", "atividade"],
                ["Ver avaliações", "avaliacao"],
                ["Entrar na sala de vídeo", "video"]
            ].forEach(([texto, aba]) => {
                const botao = criar("button", "btn-turma btn-outline", texto);
                botao.type = "button";
                botao.addEventListener("click", () => abrirAba(aba));
                atalhos.append(botao);
            });
            resumo.append(atalhos);
            painel.replaceChildren(resumo);
        } catch (erro) {
            listaVazia(erro.message);
        }
    }

    function renderizarPessoas() {
        const card = montarCartao("Pessoas da turma", "Professor responsável e alunos que participam deste espaço.");
        dadosTurma.pessoas.forEach((pessoa) => {
            const linha = criar("div", "turma-pessoa");
            const avatar = criar("span", "turma-pessoa-avatar", pessoa.nome.trim().split(/\s+/).slice(0, 2).map((x) => x[0]).join("").toUpperCase());
            const info = criar("div");
            info.append(criar("strong", "", pessoa.nome), criar("small", "", pessoa.papel));
            linha.append(avatar, info);
            card.append(linha);
        });
        painel.replaceChildren(card);
    }

    function renderizarVideo() {
        const renderToken = ++jitsiRenderToken;
        if (jitsiApi) {
            jitsiApi.dispose();
            jitsiApi = null;
        }

        const card = montarCartao("Sala de vídeo", "Entre no encontro ao vivo da turma. O espaço de reunião é exclusivo desta turma.");
        const box = criar("div", "turma-video-box");
        const topo = criar("div", "turma-video-topo");
        topo.append(criar("strong", "", `Encontro • ${dadosTurma.nome}`));
        const url = `https://meet.jit.si/${encodeURIComponent(dadosTurma.video_room)}`;
        topo.append(link("Abrir em nova aba ↗", url, ""));
        const area = criar("div", "turma-video-frame");
        area.id = "jitsi-container";
        area.setAttribute("aria-label", `Videoconferência da turma ${dadosTurma.nome}`);
        box.append(topo, area);
        card.append(box);
        card.append(criar("p", "turma-aviso-externo", "A videoconferência é fornecida pelo Jitsi. O código de entrada do Conrad não autentica os participantes dentro do serviço externo; compartilhe o link apenas com pessoas da turma."));
        painel.replaceChildren(card);

        carregarApiJitsi().then(() => {
            if (renderToken !== jitsiRenderToken) return;
            const container = document.getElementById("jitsi-container");
            if (!container || !window.JitsiMeetExternalAPI) return;
            jitsiApi = new window.JitsiMeetExternalAPI("meet.jit.si", {
                roomName: dadosTurma.video_room,
                parentNode: container,
                width: "100%",
                height: "100%",
                lang: "ptBR",
                userInfo: { displayName: usuarioAtual?.nome || "Participante Conrad" },
                configOverwrite: { prejoinConfig: { enabled: true } }
            });
        }).catch((erro) => {
            if (renderToken !== jitsiRenderToken) return;
            const container = document.getElementById("jitsi-container");
            if (!container) return;
            container.replaceChildren(criar("p", "turmas-vazio", erro.message));
            container.append(link("Abrir sala de vídeo", url, "btn-turma btn-outline"));
        });
    }

    function abrirAba(aba) {
        abaAtual = aba;
        if (aba !== "video") {
            jitsiRenderToken++;
            if (jitsiApi) {
                jitsiApi.dispose();
                jitsiApi = null;
            }
        }
        atualizarAba();
        const acoes = {
            mural: renderizarMural,
            atividade: () => renderizarConteudos("atividade"),
            avaliacao: () => renderizarConteudos("avaliacao"),
            pessoas: renderizarPessoas,
            video: renderizarVideo
        };
        (acoes[aba] || acoes.mural)();
        const url = new URL(location.href);
        url.searchParams.set("aba", aba);
        history.replaceState(null, "", url);
    }

    document.querySelectorAll("[data-aba]").forEach((botao) => {
        botao.addEventListener("click", () => abrirAba(botao.dataset.aba));
    });

    window.addEventListener("pagehide", () => {
        jitsiRenderToken++;
        if (jitsiApi) jitsiApi.dispose();
    });

    $("#copiar-codigo").addEventListener("click", async () => {
        try {
            await navigator.clipboard.writeText(dadosTurma.codigo);
            $("#copiar-codigo").textContent = "Copiado!";
        } catch {
            $("#copiar-codigo").textContent = dadosTurma.codigo;
        }
    });

    (async function iniciar() {
        if (!Number.isInteger(turmaId) || turmaId <= 0) {
            listaVazia("Turma não identificada. Volte à página Turmas e abra uma sala.");
            return;
        }
        try {
            const [resposta, sessao] = await Promise.all([
                conradFetch(`/api/turmas/${turmaId}`),
                conradFetch("/me")
            ]);
            usuarioAtual = sessao.usuario;
            dadosTurma = resposta.turma;
            dadosTurma.pessoas = resposta.pessoas || [];
            $("#turma-nome").textContent = dadosTurma.nome;
            $("#turma-meta").textContent = `${dadosTurma.disciplina}${dadosTurma.secao ? " • " + dadosTurma.secao : ""} • Professor(a): ${dadosTurma.professor}`;
            if (dadosTurma.papel === "educador") {
                $("#bloco-codigo").hidden = false;
                $("#turma-codigo").textContent = dadosTurma.codigo;
            }
            document.title = `${dadosTurma.nome} — CONRAD`;
            abrirAba(abaAtual);
        } catch (erro) {
            if (erro.status === 401) location.href = "login.html";
            else listaVazia(erro.message);
        }
    })();
})();
