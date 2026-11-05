
(function () {
    const CHAVE = "conrad-tema";
    const raiz = document.documentElement;
    const botao = document.getElementById("theme");

    if (!botao) {
        console.error("Botão de tema não encontrado!");
        return;
    }
//==========================================================================================================
    // Recupera o tema salvo
    function lerSalvo() {
        try {
            const tema = localStorage.getItem(CHAVE);

            return ["normal", "claro", "escuro"].includes(tema)
                ? tema
                : "normal";
        } catch (erro) {
            return "normal";
        }
    }
//==========================================================================================================
    // Salva a preferência
    function salvar(tema) {
        try {
            localStorage.setItem(CHAVE, tema);
        } catch (erro) {
            console.error("Não foi possível salvar o tema.");
        }
    }
    // Aplica o tema escolhido
    function aplicar(tema) {
        raiz.setAttribute("data-tema", tema);
        const icones = {
            normal: "◉",
            claro: "☀",
            escuro: "☾"
        };

        const nomes = {
            normal: "Ativar tema claro",
            claro: "Ativar tema escuro",
            escuro: "Ativar tema normal"
        };

        botao.textContent = icones[tema];
        botao.setAttribute("aria-label", nomes[tema]);
        botao.title = nomes[tema];
    }
//==========================================================================================================
    // Carrega o tema inicial
    let temaAtual = lerSalvo();
    aplicar(temaAtual);

    // Alterna entre os três temas
    botao.addEventListener("click", function () {
        if (temaAtual === "normal") {
            temaAtual = "claro";
        } else if (temaAtual === "claro") {
            temaAtual = "escuro";
        } else {
            temaAtual = "normal";
        }

        aplicar(temaAtual);
        salvar(temaAtual);
    });

})();
