(function () {
    const $ = (seletor) => document.querySelector(seletor);
    const grid = $("#lista-turmas");
    const modal = $("#modal-turma");
    const busca = $("#busca-turmas");
    let usuario = null;
    let turmas = [];

    const cores = ["#163b74", "#1f4e79", "#b85b17", "#315f82", "#8b4b19"];

    function criar(tag, classe, texto) {
        const elemento = document.createElement(tag);
        if (classe) elemento.className = classe;
        if (texto !== undefined && texto !== null) elemento.textContent = texto;
        return elemento;
    }

    function iniciais(nome) {
        return String(nome || "T")
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((parte) => parte[0].toUpperCase())
            .join("");
    }

    function abrirModal(tipo) {
        const criarForm = $("#form-criar-turma");
        const entrarForm = $("#form-entrar-turma");
        criarForm.hidden = tipo !== "criar";
        entrarForm.hidden = tipo !== "entrar";
        $("#modal-titulo").textContent = tipo === "criar" ? "Criar turma" : "Entrar em uma turma";
        $("#modal-descricao").textContent = tipo === "criar"
            ? "Monte um espaço para organizar suas aulas, atividades e encontros."
            : "Digite o código de convite enviado pelo professor.";
        $("#msg-criar-turma").textContent = "";
        $("#msg-entrar-turma").textContent = "";
        modal.classList.add("aberta");
        modal.setAttribute("aria-hidden", "false");
        const primeiroCampo = (tipo === "criar" ? criarForm : entrarForm).querySelector("input");
        primeiroCampo?.focus();
    }

    function fecharModal() {
        modal.classList.remove("aberta");
        modal.setAttribute("aria-hidden", "true");
    }

    function renderizar(lista) {
        grid.replaceChildren();
        $("#contador-turmas").textContent = `${lista.length} ${lista.length === 1 ? "turma" : "turmas"}`;

        if (!lista.length) {
            const mensagem = usuario?.tipo === "educador"
                ? "Você ainda não criou nenhuma turma. Use “Criar turma” para montar seu primeiro espaço."
                : "Você ainda não entrou em nenhuma turma. Peça o código ao professor e selecione “Entrar em uma turma”.";
            grid.append(criar("p", "turmas-vazio", mensagem));
            return;
        }

        lista.forEach((turma, indice) => {
            const card = criar("article", "turma-card");
            card.tabIndex = 0;
            card.setAttribute("role", "link");
            card.setAttribute("aria-label", `Abrir turma ${turma.nome}`);

            const capa = criar("div", "turma-card-capa");
            capa.style.background = `linear-gradient(120deg, ${cores[indice % cores.length]}, #0a1f44)`;
            const nome = criar("h2", "", turma.nome);
            const disciplina = criar("p", "", turma.disciplina || "Turma");
            const avatar = criar("span", "turma-card-iniciais", iniciais(turma.nome));
            capa.append(nome, disciplina, avatar);

            const corpo = criar("div", "turma-card-corpo");
            corpo.append(
                criar("p", "", `Professor(a): ${turma.professor || "Equipe Conrad"}`),
                criar("p", "", turma.secao ? `Seção: ${turma.secao}` : "Ambiente de aprendizagem Conrad")
            );

            const rodape = criar("div", "turma-card-rodape");
            rodape.append(
                criar("span", "", `${Number(turma.quantidade_alunos || 0)} aluno(s)`),
                criar("span", "turma-card-abrir", "Abrir turma →")
            );
            card.append(capa, corpo, rodape);
            card.addEventListener("click", () => {
                location.href = `turma.html?id=${encodeURIComponent(turma.id)}`;
            });
            card.addEventListener("keydown", (evento) => {
                if (evento.key === "Enter" || evento.key === " ") {
                    evento.preventDefault();
                    location.href = `turma.html?id=${encodeURIComponent(turma.id)}`;
                }
            });
            grid.append(card);
        });
    }

    async function carregarTurmas() {
        try {
            const dados = await conradFetch("/api/turmas");
            turmas = dados.turmas || [];
            const termo = busca.value.trim().toLocaleLowerCase("pt-BR");
            const filtradas = turmas.filter((turma) =>
                `${turma.nome} ${turma.disciplina} ${turma.secao || ""}`.toLocaleLowerCase("pt-BR").includes(termo)
            );
            renderizar(filtradas);
        } catch (erro) {
            grid.replaceChildren(criar("p", "turmas-vazio", erro.message));
            $("#contador-turmas").textContent = "Não foi possível carregar";
        }
    }

    $("#abrir-criar").addEventListener("click", () => abrirModal("criar"));
    $("#abrir-entrar").addEventListener("click", () => abrirModal("entrar"));
    document.querySelectorAll("[data-fechar-modal]").forEach((elemento) => elemento.addEventListener("click", fecharModal));
    document.addEventListener("keydown", (evento) => {
        if (evento.key === "Escape") fecharModal();
    });

    $("#form-criar-turma").addEventListener("submit", async (evento) => {
        evento.preventDefault();
        const botao = evento.currentTarget.querySelector('[type="submit"]');
        const mensagem = $("#msg-criar-turma");
        botao.disabled = true;
        mensagem.className = "form-turma-msg";
        mensagem.textContent = "Criando turma...";
        try {
            const dados = await conradFetch("/api/turmas", {
                method: "POST",
                body: JSON.stringify({
                    nome: $("#nome-turma").value.trim(),
                    disciplina: $("#disciplina-turma").value.trim(),
                    secao: $("#secao-turma").value.trim(),
                    descricao: $("#descricao-turma").value.trim()
                })
            });
            evento.currentTarget.reset();
            fecharModal();
            await carregarTurmas();
            alert(`Turma criada! Código de entrada: ${dados.codigo}`);
        } catch (erro) {
            mensagem.className = "form-turma-msg erro";
            mensagem.textContent = erro.message;
        } finally {
            botao.disabled = false;
        }
    });

    $("#form-entrar-turma").addEventListener("submit", async (evento) => {
        evento.preventDefault();
        const botao = evento.currentTarget.querySelector('[type="submit"]');
        const mensagem = $("#msg-entrar-turma");
        botao.disabled = true;
        mensagem.className = "form-turma-msg";
        mensagem.textContent = "Verificando código...";
        try {
            const dados = await conradFetch("/api/turmas/entrar", {
                method: "POST",
                body: JSON.stringify({ codigo: $("#codigo-turma").value })
            });
            fecharModal();
            location.href = `turma.html?id=${encodeURIComponent(dados.turma.id)}`;
        } catch (erro) {
            mensagem.className = "form-turma-msg erro";
            mensagem.textContent = erro.message;
        } finally {
            botao.disabled = false;
        }
    });

    $("#codigo-turma").addEventListener("input", (evento) => {
        evento.target.value = evento.target.value.toUpperCase().replace(/[^A-F0-9]/g, "").slice(0, 8);
    });
    busca.addEventListener("input", () => {
        const termo = busca.value.trim().toLocaleLowerCase("pt-BR");
        renderizar(turmas.filter((turma) =>
            `${turma.nome} ${turma.disciplina} ${turma.secao || ""}`.toLocaleLowerCase("pt-BR").includes(termo)
        ));
    });

    (async function iniciar() {
        try {
            const sessao = await conradFetch("/me");
            usuario = sessao.usuario;
            if (usuario.tipo === "educador") {
                $("#abrir-entrar").hidden = true;
                $("#abrir-criar").hidden = false;
            } else {
                $("#abrir-criar").hidden = true;
                $("#abrir-entrar").hidden = false;
            }
            await carregarTurmas();
        } catch (erro) {
            if (erro.status === 401) location.href = "login.html";
            else grid.replaceChildren(criar("p", "turmas-vazio", erro.message));
        }
    })();
})();
