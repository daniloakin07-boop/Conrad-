// JS/login-social.js
// Login e cadastro social utilizando Supabase Auth + backend Render.

(() => {
    const API_URL = "https://conrad.onrender.com";

    const SUPABASE_URL = "https://xdgguheuntobmzfyeqbc.supabase.co";
    const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_56pxaeACP5RiBEew651Oow_fT4rS1Ka";

    if (!window.supabase || !window.supabase.createClient) {
        console.error("Biblioteca do Supabase não foi carregada.");
        return;
    }

    const supabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY
    );

    // Identifica se o usuário está retornando da autenticação OAuth.
    const parametros = new URLSearchParams(window.location.search);

    const voltouDoProvedor =
        window.location.hash.includes("access_token") ||
        parametros.has("code");

    const veioComErro =
        window.location.hash.includes("error_description") ||
        parametros.has("error_description") ||
        parametros.has("error");

    const mensagemErro =
        document.getElementById("login-erro") ||
        document.getElementById("mensagemLogin") ||
        document.getElementById("mensagemCadastro");

    let loginEnviado = false;

    function mostrarErro(mensagem) {
        if (mensagemErro) {
            mensagemErro.textContent = mensagem;
            mensagemErro.hidden = false;
        } else {
            alert(mensagem);
        }
    }

    // --------------------------------------------------
    // 1. INICIAR LOGIN COM GOOGLE OU FACEBOOK
    // --------------------------------------------------

    document.querySelectorAll("[data-provider]").forEach((botao) => {
        botao.addEventListener("click", async () => {
            botao.disabled = true;

            try {
                const paginaCallback = new URL(
                    "/pages/login.html",
                    window.location.origin
                );

                // Quando o usuário inicia pelo cadastro,
                // preserva o tipo de conta selecionado.
                const formularioCadastro =
                    document.getElementById("formCadastro");

                if (formularioCadastro) {
                    const tipoSelecionado =
                        document.querySelector('input[name="tipo"]:checked');

                    paginaCallback.searchParams.set("origem", "cadastro");
                    paginaCallback.searchParams.set(
                        "tipo",
                        tipoSelecionado?.value === "educador"
                            ? "educador"
                            : "aluno"
                    );
                }

                const { error } =
                    await supabaseClient.auth.signInWithOAuth({
                        provider: botao.dataset.provider,
                        options: {
                            redirectTo: paginaCallback.toString()
                        }
                    });

                if (error) {
                    throw error;
                }

            } catch (erro) {
                console.error("Erro ao iniciar autenticação:", erro);

                botao.disabled = false;

                mostrarErro(
                    "Não foi possível iniciar o login com sua conta. Tente novamente."
                );
            }
        });
    });

    // --------------------------------------------------
    // 2. IDENTIFICAR ERROS NO RETORNO DO PROVEDOR
    // --------------------------------------------------

    if (veioComErro) {
        mostrarErro(
            "O login foi cancelado ou não pôde ser concluído. Tente novamente."
        );
    }

    // --------------------------------------------------
    // 3. RECEBER A SESSÃO DO SUPABASE
    // --------------------------------------------------

    async function criarSessaoNoServidor(sessao) {
        if (loginEnviado || !sessao?.access_token) {
            return;
        }

        loginEnviado = true;

        try {
            const corpo = {
                access_token: sessao.access_token
            };

            // Preserva o tipo escolhido durante o cadastro.
            if (parametros.get("origem") === "cadastro") {
                corpo.tipo =
                    parametros.get("tipo") === "educador"
                        ? "educador"
                        : "aluno";
            }

            const resposta = await fetch(
                `${API_URL}/auth/supabase`,
                {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(corpo)
                }
            );

            const dados = await resposta.json();

            if (!resposta.ok) {
                throw new Error(
                    dados.erro || `Erro do servidor: ${resposta.status}`
                );
            }

            // Direciona conforme o tipo de usuário.
            const pagina = dados.usuario?.tipo === "educador"
                ? "/pages/educador.html"
                : "/pages/turmas.html";

            window.location.replace(
                `${window.location.origin}${pagina}`
            );

        } catch (erro) {
            console.error("Erro ao criar sessão no Render:", erro);

            loginEnviado = false;

            mostrarErro(
                erro.message || "Não foi possível concluir o login."
            );
        }
    }

    // Só cria sessão no Render quando o usuário realmente
    // está retornando de uma tentativa de autenticação.
    if (voltouDoProvedor && !veioComErro) {
        supabaseClient.auth.onAuthStateChange((evento, sessao) => {
            if (
                sessao &&
                (evento === "SIGNED_IN" || evento === "INITIAL_SESSION")
            ) {
                criarSessaoNoServidor(sessao);
            }
        });

        // Verifica também se a sessão já foi recuperada pelo SDK.
        supabaseClient.auth.getSession().then(({ data, error }) => {
            if (error) {
                console.error("Erro ao recuperar sessão:", error);
                return;
            }

            if (data.session) {
                criarSessaoNoServidor(data.session);
            }
        });
    }

})();