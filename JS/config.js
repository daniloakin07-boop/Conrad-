/*
===============================================
CONFIGURAÇÃO COMPARTILHADA DO FRONT-END
===============================================
Inclua nas páginas com: <script src="../JS/config.js"></script>
*/
(function () {
    const emLiveServer =
        ["localhost", "127.0.0.1"].includes(location.hostname) && location.port !== "3000";

    // Live Server -> servidor local | GitHub Pages -> Render | mesma origem -> ""
    window.CONRAD_API = emLiveServer
        ? "http://127.0.0.1:3000"
        : location.hostname.endsWith("github.io")
            ? "https://conrad.onrender.com"
            : "";

    // fetch já com cookie de sessão, JSON e tratamento de erro
    window.conradFetch = async function (caminho, opcoes) {
        const resposta = await fetch(window.CONRAD_API + caminho, {
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            ...opcoes
        });
        const dados = await resposta.json().catch(() => ({}));
        if (!resposta.ok) {
            const erro = new Error(dados.erro || "Erro " + resposta.status);
            erro.status = resposta.status;
            throw erro;
        }
        return dados;
    };
})();