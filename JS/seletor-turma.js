/*
===============================================
SELETOR DE TURMA  (nova-atividade.html e nova-avaliacao.html)
===============================================
- Enche o <select id="turma"> com as turmas do professor logado (GET /api/turmas).
- Seleciona sozinho a turma da URL (ex.: nova-atividade.html?turmaId=9).
- Deixa criar uma turma nova ali mesmo (nome + disciplina) sem sair da página.

O valor do select é o ID da turma. O construtor-atividade.js lê esse valor e envia como
turma_id; o servidor descobre nome e disciplina da turma pelo banco.

Precisa do config.js carregado antes (usa conradFetch).
*/
(function () {
    "use strict";

    const seletor = document.getElementById("turma");
    if (!seletor) return;

    const aviso = document.getElementById("mensagemTurma");
    const botaoNova = document.getElementById("btnNovaTurma");
    const areaNova = document.getElementById("areaNovaTurma");
    const campoNome = document.getElementById("nomeNovaTurma");
    const campoDisciplina = document.getElementById("disciplinaNovaTurma");
    const botaoSalvar = document.getElementById("salvarTurma");
    const botaoCancelar = document.getElementById("cancelarTurma");

    const turmaDaUrl = new URLSearchParams(location.search).get("turmaId") || "";

    function dizer(texto) {
        if (aviso) aviso.textContent = texto || "";
    }

    // Busca as turmas no servidor e monta as opções. `selecionar` (opcional) é o ID a deixar marcado.
    async function carregarTurmas(selecionar) {
        seletor.replaceChildren(new Option("Carregando turmas...", ""));
        try {
            const dados = await conradFetch("/api/turmas");
            const turmas = (dados.turmas || []).filter((turma) => turma.papel === "educador");

            seletor.replaceChildren(
                new Option(turmas.length ? "Selecione uma turma..." : "Você ainda não tem turmas", "")
            );
            turmas.forEach((turma) => {
                seletor.add(new Option(turma.nome + " — " + turma.disciplina, String(turma.id)));
            });

            const alvo = String(selecionar || turmaDaUrl || "");
            if (alvo && Array.from(seletor.options).some((opcao) => opcao.value === alvo)) {
                seletor.value = alvo;
            }

            if (!turmas.length) {
                dizer("Você ainda não tem turmas. Clique em + Criar turma para começar.");
            }
        } catch (erro) {
            if (erro.status === 401) {
                location.replace("login.html");
                return;
            }
            seletor.replaceChildren(new Option("Não foi possível carregar as turmas", ""));
            dizer(erro.message);
        }
    }

    function fecharArea() {
        if (areaNova) areaNova.hidden = true;
        if (campoNome) campoNome.value = "";
        if (campoDisciplina) campoDisciplina.value = "";
    }

    async function criarTurma() {
        const nome = campoNome.value.trim();
        const disciplina = campoDisciplina.value.trim();

        if (!nome) {
            dizer("Informe o nome da turma.");
            campoNome.focus();
            return;
        }
        if (!disciplina) {
            dizer("Informe a disciplina da turma.");
            campoDisciplina.focus();
            return;
        }

        botaoSalvar.disabled = true;
        dizer("Criando turma...");
        try {
            const nova = await conradFetch("/api/turmas", {
                method: "POST",
                body: JSON.stringify({ nome, disciplina })
            });
            await carregarTurmas(nova.id); // atualiza a lista já com a turma nova marcada
            fecharArea();
            dizer("Turma criada e selecionada.");
        } catch (erro) {
            dizer(erro.message || "Não foi possível criar a turma.");
        } finally {
            botaoSalvar.disabled = false;
        }
    }

    if (botaoNova && areaNova) {
        botaoNova.addEventListener("click", () => {
            areaNova.hidden = false;
            dizer("");
            campoNome.focus();
        });
    }

    if (botaoCancelar) {
        botaoCancelar.addEventListener("click", () => {
            fecharArea();
            dizer("");
        });
    }

    if (botaoSalvar) botaoSalvar.addEventListener("click", criarTurma);

    // Enter nesses campos cria a turma; sem isso ele enviaria o formulário da atividade inteira
    [campoNome, campoDisciplina].forEach((campo) => {
        if (!campo) return;
        campo.addEventListener("keydown", (evento) => {
            if (evento.key === "Enter") {
                evento.preventDefault();
                criarTurma();
            }
        });
    });

    carregarTurmas();
})();
