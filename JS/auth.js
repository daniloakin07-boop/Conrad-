// JS/auth.js - scripts do front-end para login, cadastro e contato
// Este arquivo roda no navegador e chama as rotas do backend (server.js)

// BASE_URL: define a URL da API dependendo se estamos em localhost ou produção
const BASE_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:3000"
    : "https://conrad-virtual-school.onrender.com";

// Função utilitária para mostrar mensagens de erro/sucesso nas páginas de auth
function mostrarMensagem(elemento, texto, tipo) {
    // `elemento` é um DOM node onde a mensagem será exibida
    elemento.textContent = texto;
    // `tipo` controla a classe CSS (ex.: 'sucesso' ou 'erro')
    elemento.className = "mensagem-auth " + tipo;
}

// ---- Login: pega o formulário de login (se houver) ----
const formLogin = document.getElementById("formLogin");
if (formLogin) {
    // Ao submeter o formulário, enviamos os dados para a rota `/login`
    formLogin.addEventListener("submit", async function (e) {
        e.preventDefault(); // evita reload da página

        const email = document.getElementById("email").value.trim();
        const senha = document.getElementById("senha").value;
        const mensagem = document.getElementById("mensagemLogin");

        if (!email || !senha) {
            mostrarMensagem(mensagem, "Preencha todos os campos.", "erro");
            return;
        }

        try {
            const resposta = await fetch(`${BASE_URL}/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, senha })
            });

            const dados = await resposta.json();

            if (resposta.ok) {
                mostrarMensagem(mensagem, "Login realizado com sucesso!", "sucesso");
                window.location.href = "aluno.html";
            } else {
                mostrarMensagem(mensagem, dados.erro || "E-mail ou senha incorretos.", "erro");
            }
        } catch {
            mostrarMensagem(mensagem, "Erro ao conectar com o servidor.", "erro");
        }
    });
}

const formCadastro = document.getElementById("formCadastro");
if (formCadastro) {
    // Cadastro: coleta dados e envia para `/cadastro` no backend
    formCadastro.addEventListener("submit", async function (e) {
        e.preventDefault();

        const nome = document.getElementById("nome").value.trim();
        const email = document.getElementById("email").value.trim();
        const senha = document.getElementById("senha").value;
        const confirmasenha = document.getElementById("confirmasenha").value;
        const tipo = document.querySelector('input[name="tipo"]:checked');
        const mensagem = document.getElementById("mensagemCadastro");

        if (!nome || !email || !senha || !confirmasenha) {
            mostrarMensagem(mensagem, "Preencha todos os campos.", "erro");
            return;
        }

        if (senha !== confirmasenha) {
            mostrarMensagem(mensagem, "As senhas não coincidem.", "erro");
            return;
        }

        if (!tipo) {
            mostrarMensagem(mensagem, "Selecione um tipo de usuário.", "erro");
            return;
        }

        try {
            const resposta = await fetch(`${BASE_URL}/cadastro`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nome, email, senha, tipo: tipo.value })
            });

            const dados = await resposta.json();

            if (resposta.ok) {
                mostrarMensagem(mensagem, "Cadastro realizado com sucesso!", "sucesso");
                formCadastro.reset();
            } else {
                mostrarMensagem(mensagem, dados.erro || "Erro ao realizar cadastro.", "erro");
            }
        } catch {
            mostrarMensagem(mensagem, "Erro ao conectar com o servidor.", "erro");
        }
    });
}

const formContato = document.getElementById("formContato");
if (formContato) {
    // Contato: envia mensagem do usuário para `/contato` no backend
    formContato.addEventListener("submit", async function (e) {
        e.preventDefault();

        const nome = document.getElementById("nome").value.trim();
        const email = document.getElementById("email").value.trim();
        const mensagemTexto = document.getElementById("mensagem").value.trim();
        const mensagem = document.getElementById("mensagemContato");

        if (!nome || !email || !mensagemTexto) {
            mostrarMensagem(mensagem, "Preencha todos os campos.", "erro");
            return;
        }

        try {
            const resposta = await fetch(`${BASE_URL}/contato`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nome, email, mensagem: mensagemTexto })
            });

            const dados = await resposta.json();

            if (resposta.ok) {
                mostrarMensagem(mensagem, "Mensagem enviada com sucesso!", "sucesso");
                formContato.reset();
            } else {
                mostrarMensagem(mensagem, dados.erro || "Falha ao enviar mensagem.", "erro");
            }
        } catch {
            mostrarMensagem(mensagem, "Erro ao conectar com o servidor.", "erro");
        }
    });
}