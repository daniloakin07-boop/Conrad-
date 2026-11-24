/* ==============================================================
   JS/tema.js — controle de tema da CONRAD (normal | claro | escuro)

   COMO USAR (em TODAS as páginas, dentro do <head>, SEM defer):
       <script src="../JS/tema.js"></script>

   Por que no <head> e sem defer?
   O script roda de forma síncrona antes da primeira pintura e já grava
   o tema salvo em <html data-tema="...">. Assim a página nunca "pisca"
   com o tema errado (FOUC). Só a montagem do botão espera o DOM ficar pronto.

   O que faz:
     1. Lê o tema salvo no localStorage (chave "conrad-tema").
     2. Aplica o tema na raiz do documento.
     3. Insere o controle de tema na página (não depende de nenhum botão
        existente no HTML):
          - dentro de [data-tema-host], se a página tiver esse marcador;
          - senão, no cabeçalho .topo (antes dos botões de conta);
          - senão, como botão flutuante discreto no canto da tela.
     4. Atualiza ícone/estado (aria-checked) e anuncia a troca a leitores de tela.
     5. Salva a nova preferência e sincroniza as outras abas abertas.

   API pública (opcional): window.ConradTema.obter() / .definir("escuro")
   ============================================================== */
(function () {
    "use strict";

    var CHAVE = "conrad-tema";
    var TEMAS = ["normal", "claro", "escuro"];
    var RAIZ = document.documentElement;

    // Menu lateral retrátil: se foi deixado recolhido, aplica já na primeira pintura
    // (o botão e os ícones são criados depois, em layout.js). Evita o menu "pular" de
    // largura a cada página aberta.
    try {
        if (localStorage.getItem("conrad-menu-recolhido") === "1") RAIZ.classList.add("menu-recolhido");
    } catch (e) { /* sem localStorage: o menu segue expandido */ }

    var ROTULOS = {
        normal: "Normal",
        claro: "Claro",
        escuro: "Escuro"
    };

    // Cor da barra do navegador no celular, igual ao cabeçalho de cada tema
    var COR_BARRA = { normal: "#0a1f44", claro: "#ffffff", escuro: "#0a1224" };

    // Ícones SVG (traço herdado de currentColor, sem dependências externas)
    var ICONES = {
        normal:
            '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
            '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor"/></svg>',
        claro:
            '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
            '<circle cx="12" cy="12" r="4"/>' +
            '<path d="M12 2.5v2.2M12 19.3v2.2M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6"/></svg>',
        escuro:
            '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
            '<path d="M20.5 13.2A8.6 8.6 0 1 1 10.8 3.5a6.7 6.7 0 0 0 9.7 9.7z"/></svg>'
    };

    var atual = "normal";

    /* ------------------------------------------------ armazenamento */
    function lerSalvo() {
        try {
            var salvo = localStorage.getItem(CHAVE);
            return TEMAS.indexOf(salvo) !== -1 ? salvo : "normal";
        } catch (erro) {
            return "normal"; // armazenamento bloqueado (modo privado etc.)
        }
    }

    function salvar(tema) {
        try {
            localStorage.setItem(CHAVE, tema);
        } catch (erro) {
            /* sem persistência: o tema vale só para esta página */
        }
    }

    /* ------------------------------------------------ aplicação */
    function aplicar(tema) {
        atual = tema;
        RAIZ.setAttribute("data-tema", tema);
        atualizarMetaCor(tema);
        atualizarControles();
    }

    function atualizarMetaCor(tema) {
        if (!document.head) return;
        var meta = document.querySelector('meta[name="theme-color"]');
        if (!meta) {
            meta = document.createElement("meta");
            meta.name = "theme-color";
            document.head.appendChild(meta);
        }
        meta.content = COR_BARRA[tema];
    }

    function definir(tema, opcoes) {
        if (TEMAS.indexOf(tema) === -1 || tema === atual) return;
        var persistir = !opcoes || opcoes.persistir !== false;

        var trocar = function () { aplicar(tema); };
        var reduzir = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        // Troca com fade nativo quando o navegador suporta; senão, troca direta
        if (document.startViewTransition && !reduzir && document.body) {
            document.startViewTransition(trocar);
        } else {
            trocar();
        }

        if (persistir) {
            salvar(tema);
            anunciar("Tema " + ROTULOS[tema].toLowerCase() + " ativado");
        }
    }

    /* ------------------------------------------------ controle visual */
    var regiaoViva = null;

    function anunciar(texto) {
        if (!regiaoViva) return;
        regiaoViva.textContent = "";
        // pequeno atraso para o leitor de tela perceber a mudança do texto
        window.setTimeout(function () { regiaoViva.textContent = texto; }, 30);
    }

    function criarControle() {
        var grupo = document.createElement("div");
        grupo.className = "tema-ctl";
        grupo.setAttribute("role", "radiogroup");
        grupo.setAttribute("aria-label", "Tema da interface");
        grupo.setAttribute("data-tema-controle", "");

        var marcador = document.createElement("span");
        marcador.className = "tema-ctl__marcador";
        marcador.setAttribute("aria-hidden", "true");
        grupo.appendChild(marcador);

        TEMAS.forEach(function (tema) {
            var botao = document.createElement("button");
            botao.type = "button";
            botao.className = "tema-ctl__opcao";
            botao.setAttribute("role", "radio");
            botao.setAttribute("data-tema-valor", tema);
            botao.title = "Tema " + ROTULOS[tema].toLowerCase();
            botao.innerHTML = ICONES[tema] + '<span class="tema-ctl__rotulo">' + ROTULOS[tema] + "</span>";
            grupo.appendChild(botao);
        });

        var viva = document.createElement("span");
        viva.className = "tema-ctl__anuncio";
        viva.setAttribute("role", "status");
        viva.setAttribute("aria-live", "polite");
        grupo.appendChild(viva);

        grupo.addEventListener("click", function (evento) {
            var alvo = evento.target.closest("[data-tema-valor]");
            if (alvo && grupo.contains(alvo)) definir(alvo.getAttribute("data-tema-valor"));
        });

        // Teclado: setas, Home e End movem a seleção (padrão de radiogroup)
        grupo.addEventListener("keydown", function (evento) {
            var indice = TEMAS.indexOf(atual);
            var proximo = null;
            switch (evento.key) {
                case "ArrowRight":
                case "ArrowDown":
                    proximo = (indice + 1) % TEMAS.length; break;
                case "ArrowLeft":
                case "ArrowUp":
                    proximo = (indice + TEMAS.length - 1) % TEMAS.length; break;
                case "Home": proximo = 0; break;
                case "End": proximo = TEMAS.length - 1; break;
                default: return;
            }
            evento.preventDefault();
            definir(TEMAS[proximo]);
            var botao = grupo.querySelector('[data-tema-valor="' + TEMAS[proximo] + '"]');
            if (botao) botao.focus();
        });

        return grupo;
    }

    function atualizarControles() {
        var indice = TEMAS.indexOf(atual);
        var grupos = document.querySelectorAll("[data-tema-controle]");
        for (var g = 0; g < grupos.length; g++) {
            grupos[g].style.setProperty("--tema-indice", indice);
            var opcoes = grupos[g].querySelectorAll("[data-tema-valor]");
            for (var i = 0; i < opcoes.length; i++) {
                var ativo = opcoes[i].getAttribute("data-tema-valor") === atual;
                opcoes[i].setAttribute("aria-checked", ativo ? "true" : "false");
                opcoes[i].tabIndex = ativo ? 0 : -1;
            }
            var viva = grupos[g].querySelector(".tema-ctl__anuncio");
            if (viva) regiaoViva = viva;
        }
    }

    function montar() {
        // Remove o botão antigo (#theme), se alguma página ainda o tiver
        var legado = document.getElementById("theme");
        if (legado && legado.parentNode) legado.parentNode.removeChild(legado);

        if (document.querySelector("[data-tema-controle]")) {
            atualizarControles();
            return;
        }

        var controle = criarControle();
        var host = document.querySelector("[data-tema-host]");
        var topo = document.querySelector(".topo");

        if (host) {
            controle.classList.add("tema-ctl--host");
            host.appendChild(controle);
        } else if (topo) {
            controle.classList.add("tema-ctl--topo");
            var acoes = topo.querySelector(":scope > .acoes-topo, :scope > .topo-acoes");
            topo.insertBefore(controle, acoes);
        } else {
            controle.classList.add("tema-ctl--flutuante");
            document.body.appendChild(controle);
        }
        atualizarControles();
    }

    // Aplica o tema salvo AGORA (antes da primeira pintura)
    aplicar(lerSalvo());

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", montar);
    } else {
        montar();
    }

    // Mantém várias abas/janelas abertas no mesmo tema
    window.addEventListener("storage", function (evento) {
        if (evento.key === CHAVE && TEMAS.indexOf(evento.newValue) !== -1 && evento.newValue !== atual) {
            definir(evento.newValue, { persistir: false });
        }
    });

    window.ConradTema = {
        obter: function () { return atual; },
        definir: definir,
        temas: TEMAS.slice()
    };
})();
