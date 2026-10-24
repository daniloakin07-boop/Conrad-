// JS/layout.js - comportamento comum a todas as telas: topo (usuário / Sair) e menu lateral
// Este arquivo roda no navegador e pergunta ao backend (rota GET /me do server.js) quem está logado.
// Se o servidor não responder (ex.: página aberta sem o Express), a tela continua com o HTML estático.
//
// O que ele faz:
//   1. Topo: logado -> mostra o nome e o botão Sair (que encerra a sessão de verdade);
//            deslogado -> mostra Entrar / Criar conta.
//   2. Menu lateral: preenche nome e tipo de usuário. Nas telas compartilhadas
//      (data-menu="auto" no <aside>, ex.: salas e bate-papo) escolhe o menu de educador ou de aluno.
//   3. Troca textos marcados com data-nome-usuario e preenche campos marcados com data-campo="nome|email".

(function () {
    // Mesma regra do auth.js. Fica dentro de uma função para não conflitar com o BASE_URL dele.
    const API = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
        ? `${window.location.protocol}//${window.location.hostname}:3000`
        : "https://conrad.onrender.com";

    // Estamos na index.html (raiz) ou dentro de /pages/ ? Isso muda o caminho dos links.
    const naRaiz = !window.location.pathname.includes("/pages/");
    const caminho = (arquivo) => (naRaiz ? "pages/" : "") + arquivo;
    const INICIO = naRaiz ? "index.html" : "../index.html";

    // Página de perfil de cada tipo de usuário (a mesma regra usada no login)
    const PERFIL = { educador: "perfil-educador.html", aluno: "perfil-aluno.html" };

    // Menus laterais. Cada item é [texto, arquivo]. Mantenha igual ao HTML das páginas.
    const MENUS = {
        educador: {
            titulo: "Conrad Educador",
            rotulo: "Educador",
            itens: [
                ["Painel", "educador.html"],
                ["Minhas turmas", "educador.html#turmas"],
                ["Avaliações", "avaliação.html"],
                ["Atividades", "atividades.html"],
                ["Agenda", "agenda-professor.html"],
                ["Bate-Papo", "bate-papo.html"],
                ["Salas virtuais", "salas.html"],
                ["Meu perfil", "perfil-educador.html"]
            ]
        },
        aluno: {
            titulo: "Conrad Aluno",
            rotulo: "Aluno",
            itens: [
                ["Painel", "aluno.html"],
                ["Horário das aulas", "dashboard.html"],
                ["Calendário", "aluno.html#calendario"],
                ["Frequência das aulas", "aluno.html#frequencia"],
                ["Desempenho do aluno", "aluno.html#desempenho"],
                ["Atividades", "avaliação.html"],
                ["Bate-Papo", "bate-papo.html"],
                ["Salas virtuais", "salas.html"],
                ["Meu perfil", "perfil-aluno.html"]
            ]
        }
    };

    // Contas antigas têm `tipo` nulo: tratamos como aluno (igual ao auth.js)
    function tipoDe(usuario) {
        return usuario && usuario.tipo === "educador" ? "educador" : "aluno";
    }

    // Cria um <a> usando textContent (nunca innerHTML) porque o nome vem do banco de dados
    function criarLink(texto, href, classe) {
        const a = document.createElement("a");
        a.href = href;
        a.className = classe;
        a.textContent = texto;
        return a;
    }

    function nomeNoTopo(usuario) {
        const partes = String(usuario.nome || "").trim().split(/\s+/).filter(Boolean);
        if (partes.length === 0) return "Minha conta";
        if (tipoDe(usuario) === "educador") return "Prof. " + partes[0];
        return partes.length > 2 ? partes[0] + " " + partes[partes.length - 1] : partes.join(" ");
    }

    // ---------------------------------------------------------------- TOPO
    function montarTopo(usuario) {
        const caixa = document.querySelector(".topo .acoes-topo, .topo .topo-acoes");
        if (!caixa) return;

        if (!usuario) {
            // Deslogado: mesmos botões da index
            caixa.className = "topo-acoes";
            caixa.replaceChildren(
                criarLink("Entrar", caminho("login.html"), "btn-link"),
                criarLink("Criar conta", caminho("cadastro.html"), "btn-primario")
            );
            return;
        }

        // Logado: botão de perfil + Sair
        caixa.className = "acoes-topo";

        const perfil = criarLink("", caminho(PERFIL[tipoDe(usuario)]), "user-link");
        perfil.setAttribute("aria-label", "Meu perfil");
        const avatar = document.createElement("span");
        avatar.className = "user-avatar";
        avatar.textContent = "👤";
        const nome = document.createElement("span");
        nome.textContent = nomeNoTopo(usuario);
        perfil.append(avatar, nome);

        const sair = criarLink("Sair", INICIO, "logout-link");
        sair.setAttribute("aria-label", "Sair da conta");
        sair.addEventListener("click", async function (e) {
            e.preventDefault();
            try {
                // Encerra a sessão no servidor (rota POST /logout)
                await fetch(`${API}/logout`, { method: "POST", credentials: "include" });
            } catch {
                // se o servidor não responder, voltamos para a página inicial mesmo assim
            }
            window.location.href = INICIO;
        });

        caixa.replaceChildren(perfil, sair);
    }

    // ---------------------------------------------------------------- MENU LATERAL
    // Descobre qual item do menu corresponde à página aberta (considera o #ancora)
    function itemAtivo(itens) {
        const arquivo = decodeURIComponent(window.location.pathname.split("/").pop()).normalize("NFC");
        const ancora = window.location.hash;
        const doArquivo = itens.filter((i) => i[1].split("#")[0].normalize("NFC") === arquivo);
        const comAncora = doArquivo.find((i) => i[1].includes("#") && "#" + i[1].split("#")[1] === ancora);
        return comAncora || doArquivo.find((i) => !i[1].includes("#")) || doArquivo[0];
    }

    function montarMenu(aside, tipo) {
        const menu = MENUS[tipo];
        const nav = aside.querySelector("nav");
        const titulo = aside.querySelector("h3");
        if (!nav) return;

        const ativo = itemAtivo(menu.itens);
        if (titulo) titulo.textContent = menu.titulo;
        nav.replaceChildren(...menu.itens.map((item) =>
            criarLink(item[0], item[1], "menu-item" + (item === ativo ? " ativo" : ""))
        ));
    }

    function preencherMenuLateral(usuario) {
        const tipo = tipoDe(usuario);

        document.querySelectorAll(".menu-lateral").forEach((aside) => {
            if (aside.dataset.menu === "auto") montarMenu(aside, tipo);

            const bloco = aside.querySelector(".menu-perfil");
            if (bloco) {
                const nome = bloco.querySelector("strong");
                const papel = bloco.querySelector("span");
                if (nome) nome.textContent = usuario.nome || "Minha conta";
                if (papel) papel.textContent = MENUS[tipo].rotulo;
            }
        });
    }

    // ---------------------------------------------------------------- TEXTOS E CAMPOS
    function preencherDados(usuario) {
        document.querySelectorAll("[data-nome-usuario]").forEach((el) => {
            if (usuario.nome) el.textContent = usuario.nome;
        });
        document.querySelectorAll("[data-campo]").forEach((campo) => {
            const valor = usuario[campo.dataset.campo];
            if (valor) campo.value = valor;
        });
    }

    // ---------------------------------------------------------------- SESSÃO
    // Retorna { logado: true, usuario } | { logado: false } | null (servidor indisponível)
    async function carregarSessao() {
        try {
            const resposta = await fetch(`${API}/me`, { credentials: "include" });
            if (resposta.status === 401) return { logado: false };
            if (!resposta.ok) return null;

            const dados = await resposta.json();
            return dados.logado ? { logado: true, usuario: dados.usuario } : { logado: false };
        } catch {
            return null;
        }
    }

    async function iniciar() {
        const sessao = await carregarSessao();
        if (!sessao) return; // sem servidor: mantém o HTML como está

        if (!sessao.logado) {
            montarTopo(null);
            return;
        }

        montarTopo(sessao.usuario);
        preencherMenuLateral(sessao.usuario);
        preencherDados(sessao.usuario);
    }

    iniciar();
})();
