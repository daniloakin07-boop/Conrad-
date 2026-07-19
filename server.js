/*
===============================================
1 PARTE - CONFIGURAR O SERVIDOR
===============================================
*/
// Importar as variáveis de ambiente
require("dotenv").config();

// 1. Importar o Express - ele cria e gerencia o servidor
const express = require("express");

// 2. Importar o path - ajuda a montar caminhos de arquivos
const path = require("path");

// 3. Importar o CORS - permite que o navegador "converse" com o servidor
const cors = require("cors");

// 4. Importa o session - permite gerenciar sessões de usuário
const session = require("express-session");

// 5. Importa o bcryptjs - para criptografar e comparar senhas
const bcrypt = require("bcryptjs");

// 6. Cria o servidor (como ligar um pc por ex)
const app = express();

// 7. "Bancos" em memória (sem banco de dados de verdade por enquanto)
const usuarios = [];
const contatos = [];

// 8. Cria uma lista de origens permitidas
const listOrigins = [
    "http://localhost:5501", // ambiente local (live server)
    "http://127.0.0.1:5501", // variação de localhost
    "http://localhost:3000"  // ambiente local (servindo os arquivos estáticos)
];

// 9. Ativa o CORS - libera a comunicação entre front-end e back-end
app.use(cors({
    origin: listOrigins, // só aceita requisições dessas origens
    credentials: true, // permite o envio de cookies entre domínios
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        // métodos permitidos
    allowedHeaders: ["Content-Type", "Authorization"] // cabeçalhos aceitos
}));

// 10. Ativa o leitor de JSON - permite entender os dados recebidos
// Sem isso, o servidor não consegue ler o que o formulário envia
app.use(express.json());

// 11. Serve os arquivos estáticos do projeto (html, css, imagens...)
app.use(express.static(path.join(__dirname, "..")));

// 12. Configuração de Sessão (do navegador)
const sessionConfig = {
    secret: process.env.SESSION_SECRET || "segredo-conrad",
        // chave secreta para assinar o cookie
    resave: false,
        // não salva a sessão se não houver mudança
    saveUninitialized: false,
        // não cria sessão para usuários não logados
    name: "conrad.sid",
        // nome personalizado do cookie da sessão
    cookie: {
        httpOnly: true, // bloqueia o acesso via JavaScript
        maxAge: 1000 * 60 * 60 // sessão expira em 1 hora (em ms)
    }
};

// 13. Separa o ambiente de teste (localhost) do de produção (Render)
if (process.env.NODE_ENV == "production") { // ambiente de produção
    app.set("trust proxy", 1), // confia no proxy do Render
    sessionConfig.cookie.sameSite = "none", // necessário para os cookies
    sessionConfig.cookie.secure = true // cookie só trafega em https
} else { // ambiente de desenvolvimento (teste)
    sessionConfig.cookie.sameSite = "lax", // funciona em localhost sem HTTPS
    sessionConfig.cookie.secure = false // permite cookie sem HTTPS local
}

app.use(session(sessionConfig)); // configura a sessão no servidor

/*
===============================================
2 PARTE - CRIAR ROTAS
===============================================
*/

// 1. Define a rota GET "/"
app.get("/", function (req, res) {
    res.redirect("/pages/index.html");
});

// 2. Define a rota POST "/cadastro"
app.post("/cadastro", async (req, res) => {
    try {
        const { nome, email, senha, tipo } = req.body;

        if (!nome || !email || !senha || !tipo) {
            return res.status(400).json({ erro: "Preencha todos os campos" });
        }

        const usuarioExiste = usuarios.find((u) => u.email === email);

        if (usuarioExiste) {
            return res.status(409).json({ erro: "E-mail já cadastrado" });
        }

        const senhaHash = await bcrypt.hash(senha, 10);

        const usuario = {
            id: usuarios.length + 1,
            nome: nome,
            email: email,
            senha: senhaHash,
            tipo: tipo
        };

        usuarios.push(usuario);

        req.session.usuario = {
            id: usuario.id,
            nome: usuario.nome,
            email: usuario.email,
            tipo: usuario.tipo
        };

        res.status(201).json({ mensagem: "Cadastro realizado com sucesso!", usuario: req.session.usuario });
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: "Erro ao cadastrar usuário" });
    }
});

// 3. Define a rota POST "/login"
app.post("/login", async (req, res) => {
    try {
        const { email, senha } = req.body;

        if (!email || !senha) {
            return res.status(400).json({ erro: "Preencha todos os campos" });
        }

        const usuario = usuarios.find((u) => u.email === email);

        if (!usuario) {
            return res.status(401).json({ erro: "Usuário não encontrado" });
        }

        const senhaCorreta = await bcrypt.compare(senha, usuario.senha);

        if (!senhaCorreta) {
            return res.status(401).json({ erro: "Senha inválida" });
        }

        req.session.usuario = {
            id: usuario.id,
            nome: usuario.nome,
            email: usuario.email,
            tipo: usuario.tipo
        };

        res.json({ mensagem: "Login realizado com sucesso!", usuario: req.session.usuario });
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: "Erro ao fazer login" });
    }
});

// 4. Define a rota GET "/me" - verificar sessão
app.get("/me", (req, res) => {
    if (!req.session.usuario) {
        return res.status(401).json({ logado: false });
    }

    res.json({
        logado: true,
        usuario: req.session.usuario
    });
});

// 5. Define a rota POST "/logout" - encerrar sessão
app.post("/logout", (req, res) => {
    req.session.destroy(() => {
        res.clearCookie("conrad.sid");
        res.json({ mensagem: "Logout realizado" });
    });
});

// 6. Define a rota POST "/contato"
app.post("/contato", (req, res) => {
    const { nome, email, mensagem } = req.body;

    if (!nome || !email || !mensagem) {
        return res.status(400).json({ erro: "Todos os campos são obrigatórios." });
    }

    const contato = {
        id: contatos.length + 1,
        nome: nome,
        email: email,
        mensagem: mensagem
    };

    contatos.push(contato);

    res.status(201).json({ id: contato.id });
});

// 7. Define a rota GET "/health"
app.get("/health", (req, res) => {
    res.json({ status: "ok" });
});

/*
===============================================
3 PARTE - INICIAR O SERVIDOR
===============================================
*/
const PORT = process.env.PORT || 3000;

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Servidor rodando na porta ${PORT}`);
    });
}

module.exports = app;