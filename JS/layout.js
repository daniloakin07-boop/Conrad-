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
//   4. Menu lateral retrátil: ícone em cada item e botão de seta que recolhe o menu (só ícones).
//      A escolha fica salva no navegador e vale para todas as páginas.

(function () {
    // Mesma regra do auth.js. Fica dentro de uma função para não conflitar com o BASE_URL dele.
    const emServidorLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    const emHospedagemRemota = window.location.hostname.endsWith("github.io") || window.location.hostname.endsWith("vercel.app");
    const API = emServidorLocal
        ? `${window.location.protocol}//${window.location.hostname}:3000`
        : emHospedagemRemota
            ? "https://conrad.onrender.com"
            : "";

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
                ["Turmas", "turmas.html"],
                ["Atividades", "atividades.html"],
                ["Avaliações", "avaliacoes.html"],
                ["Agenda", "agenda-professor.html"],
                ["Bate-papo", "bate-papo.html"],
                ["Salas de vídeo", "salas.html"],
                ["Meu perfil", "perfil-educador.html"]
            ]
        },
        aluno: {
            titulo: "Conrad Aluno",
            rotulo: "Aluno",
            itens: [
                ["Painel", "aluno.html"],
                ["Turmas", "turmas.html"],
                ["Atividades", "atividades.html"],
                ["Avaliações", "avaliacoes.html"],
                ["Horário das aulas", "dashboard.html"],
                ["Bate-papo", "bate-papo.html"],
                ["Salas de vídeo", "salas.html"],
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
        const tipoConteudo = new URLSearchParams(window.location.search).get("tipo");
        let destinoAtual = arquivo;
        if (arquivo === "turma.html") destinoAtual = "turmas.html";
        if (arquivo === "nova-atividade.html") destinoAtual = "atividades.html";
        if (arquivo === "nova-avaliacao.html") destinoAtual = "avaliacoes.html";
        if (arquivo === "professor-correcao.html" || arquivo === "aluno-atividades.html") {
            destinoAtual = tipoConteudo === "avaliacao" ? "avaliacoes.html" : "atividades.html";
        }
        const doArquivo = itens.filter((i) => i[1].split("#")[0].normalize("NFC") === destinoAtual);
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
        nav.setAttribute("aria-label", "Menu principal");
        nav.replaceChildren(...menu.itens.map((item) => {
            const link = criarItemMenu(item[0], item[1], item === ativo);
            if (item === ativo) link.setAttribute("aria-current", "page");
            return link;
        }));
    }

    function preencherMenuLateral(usuario) {
        const tipo = tipoDe(usuario);

        document.querySelectorAll(".menu-lateral").forEach((aside) => {
            // Todas as páginas internas usam o mesmo menu lateral da página Turmas.
            aside.dataset.menu = "auto";
            montarMenu(aside, tipo);

            const bloco = aside.querySelector(".menu-perfil");
            if (bloco) {
                const nome = bloco.querySelector("strong");
                const papel = bloco.querySelector("span");
                if (nome) nome.textContent = usuario.nome || "Minha conta";
                if (papel) papel.textContent = MENUS[tipo].rotulo;
            }
        });

        // O menu foi refeito acima: reaplica o estado (dicas dos ícones quando recolhido)
        aplicarMenuRecolhido(document.documentElement.classList.contains("menu-recolhido"));
    }

    // ---------------------------------------------------------------- MENU RETRÁTIL
    // Cada item do menu ganha um ícone e o topo do menu ganha um botão de seta que recolhe
    // a barra lateral (só ícones). A escolha fica salva neste navegador e vale para todas as
    // páginas: ela vira a classe "menu-recolhido" na raiz do documento (estilos em layout-painel.css).
    const CHAVE_MENU = "conrad-menu-recolhido";

    // Ícones de traço. São textos fixos escritos aqui (nunca vêm do banco), por isso podem usar innerHTML.
    const ICONES_MENU = {
        painel: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
        turmas: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
        atividades: '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="15" y2="16"/>',
        avaliacoes: '<circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>',
        horario: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
        agenda: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
        chat: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
        salas: '<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>',
        perfil: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
        padrao: '<circle cx="12" cy="12" r="3"/>'
    };

    // Qual ícone usar em cada página do menu
    const ICONE_POR_ARQUIVO = {
        "aluno.html": "painel",
        "educador.html": "painel",
        "turmas.html": "turmas",
        "atividades.html": "atividades",
        "avaliacoes.html": "avaliacoes",
        "dashboard.html": "horario",
        "agenda-professor.html": "agenda",
        "bate-papo.html": "chat",
        "salas.html": "salas",
        "perfil-aluno.html": "perfil",
        "perfil-educador.html": "perfil"
    };

    function arquivoDoLink(href) {
        return String(href || "").split("#")[0].split("?")[0].split("/").pop();
    }

    function criarIconeMenu(arquivo) {
        const caixa = document.createElement("span");
        caixa.className = "menu-item-icone";
        caixa.setAttribute("aria-hidden", "true");
        caixa.innerHTML =
            '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" focusable="false">' +
            ICONES_MENU[ICONE_POR_ARQUIVO[arquivo] || "padrao"] +
            "</svg>";
        return caixa;
    }

    // Item do menu: ícone + texto (o texto entra por textContent). Recolhido, só o ícone aparece.
    function criarItemMenu(texto, href, ativo) {
        const link = document.createElement("a");
        link.href = href;
        link.className = "menu-item" + (ativo ? " ativo" : "");
        const rotulo = document.createElement("span");
        rotulo.className = "menu-item-texto";
        rotulo.textContent = texto;
        link.append(criarIconeMenu(arquivoDoLink(href)), rotulo);
        return link;
    }

    // Menus que já vêm escritos no HTML: coloca o ícone nos links que existirem
    function decorarItemMenu(link) {
        if (link.querySelector(".menu-item-icone")) return;
        const rotulo = document.createElement("span");
        rotulo.className = "menu-item-texto";
        rotulo.textContent = link.textContent.trim();
        link.replaceChildren(criarIconeMenu(arquivoDoLink(link.getAttribute("href"))), rotulo);
    }

    function lerMenuRecolhido() {
        try {
            return localStorage.getItem(CHAVE_MENU) === "1";
        } catch {
            return false;
        }
    }

    function salvarMenuRecolhido(recolhido) {
        try {
            localStorage.setItem(CHAVE_MENU, recolhido ? "1" : "0");
        } catch {
            // sem armazenamento: a escolha vale só até trocar de página
        }
    }

    function aplicarMenuRecolhido(recolhido) {
        document.documentElement.classList.toggle("menu-recolhido", recolhido);

        const rotuloBotao = recolhido ? "Expandir menu lateral" : "Recolher menu lateral";
        document.querySelectorAll(".menu-alternar").forEach((botao) => {
            botao.setAttribute("aria-expanded", String(!recolhido));
            botao.setAttribute("aria-label", rotuloBotao);
            botao.title = rotuloBotao;
        });

        // Recolhido, o nome da página aparece como dica ao passar o mouse no ícone
        document.querySelectorAll(".menu-lateral .menu-item").forEach((link) => {
            if (recolhido) link.title = link.textContent.trim();
            else link.removeAttribute("title");
        });
    }

    function criarBotaoAlternar() {
        const botao = document.createElement("button");
        botao.type = "button";
        botao.className = "menu-alternar";
        botao.innerHTML =
            '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
            '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>';
        botao.addEventListener("click", () => {
            const recolher = !document.documentElement.classList.contains("menu-recolhido");
            salvarMenuRecolhido(recolher);
            aplicarMenuRecolhido(recolher);
        });
        return botao;
    }

    // Roda assim que a página abre (sem esperar o servidor): ícones, botão e estado salvo
    function prepararMenuRetratil() {
        const menus = document.querySelectorAll(".menu-lateral");
        if (menus.length === 0) return;

        menus.forEach((aside) => {
            aside.querySelectorAll("nav .menu-item").forEach(decorarItemMenu);
            if (!aside.querySelector(".menu-alternar")) aside.prepend(criarBotaoAlternar());
        });
        aplicarMenuRecolhido(lerMenuRecolhido());
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

    function carregarAssistenteIA() {
        if (document.querySelector("#conrad-ia-fab")) return;
        const script = document.createElement("script");
        script.src = naRaiz ? "JS/agente-ui.js" : "../JS/agente-ui.js";
        document.body.appendChild(script);
    }

    function padronizarNavegacaoPrincipal() {
        const nomes = {
            "index.html": "Início",
            "sobre.html": "Sobre",
            "contato.html": "Contato"
        };

        document.querySelectorAll(".topo .menu a").forEach((link) => {
            const href = (link.getAttribute("href") || "").split(/[?#]/)[0];
            const arquivo = href.split("/").pop().toLocaleLowerCase("pt-BR");
            const texto = link.textContent.trim().toLocaleLowerCase("pt-BR");
            const nome = nomes[arquivo] || nomes[texto + ".html"];
            if (nome) link.textContent = nome;
        });
    }

    async function iniciar() {
        // Corrige a capitalização mesmo antes da consulta da sessão ao servidor.
        padronizarNavegacaoPrincipal();
        prepararMenuRetratil();
        const sessao = await carregarSessao();
        if (!sessao) return; // sem servidor: mantém o HTML como está

        if (!sessao.logado) {
            montarTopo(null);
            return;
        }

        montarTopo(sessao.usuario);
        preencherMenuLateral(sessao.usuario);
        preencherDados(sessao.usuario);
        carregarAssistenteIA();
    }

    iniciar();
})();
