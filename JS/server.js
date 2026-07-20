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

// 7. Importa o pool de conexão com o banco de dados
const pool = require("./db.js");

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

// 10.1. Loga cada requisição recebida - ajuda a ver no terminal o que está chegando
app.use((req, res, next) => {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
    next();
});

// 11. Configuração de Sessão (do navegador)
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

// 12. Separa o ambiente de teste (localhost) do de produção (Render)
if (process.env.NODE_ENV == "production") { // ambiente de produção
    app.set("trust proxy", 1), // confia no proxy do Render
    sessionConfig.cookie.sameSite = "none", // necessário para os cookies
    sessionConfig.cookie.secure = true // cookie só trafega em https
} else { // ambiente de desenvolvimento (teste)
    sessionConfig.cookie.sameSite = "lax", // funciona em localhost sem HTTPS
    sessionConfig.cookie.secure = false // permite cookie sem HTTPS local
}

app.use(session(sessionConfig)); // configura a sessão no servidor

// 13. Páginas que só podem ser acessadas por quem já fez cadastro/login
const paginasProtegidas = ["aluno.html", "educador.html"];

app.get("/pages/:pagina", function (req, res, next) {
    if (paginasProtegidas.includes(req.params.pagina) && !req.session.usuario) {
        return res.redirect("/pages/login.html");
    }
    next();
});

// 14. Serve os arquivos estáticos do projeto (html, css, imagens...)
app.use(express.static(path.join(__dirname, "..")));

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

        const [existentes] = await pool.execute(
            "SELECT id FROM tb_usuarios WHERE email = ?", [email]
        );

        if (existentes.length > 0) {
            return res.status(409).json({ erro: "E-mail já cadastrado" });
        }

        const senhaHash = await bcrypt.hash(senha, 10);

        const [resultado] = await pool.execute(
            "INSERT INTO tb_usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, ?)",
            [nome, email, senhaHash, tipo]
        );

        req.session.usuario = {
            id: resultado.insertId,
            nome: nome,
            email: email,
            tipo: tipo
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

        const [linhas] = await pool.execute(
            "SELECT id, nome, email, senha, tipo FROM tb_usuarios WHERE email = ?", [email]
        );

        if (linhas.length === 0) {
            return res.status(401).json({ erro: "Usuário não encontrado" });
        }

        const usuario = linhas[0];

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
app.post("/contato", async (req, res) => {
    try {
        const { nome, email, mensagem } = req.body;

        if (!nome || !email || !mensagem) {
            return res.status(400).json({ erro: "Todos os campos são obrigatórios." });
        }

        const [resultado] = await pool.execute(
            "INSERT INTO tb_contatos (nome, email, mensagem) VALUES (?, ?, ?)",
            [nome, email, mensagem]
        );

        res.status(201).json({ id: resultado.insertId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: "Erro ao enviar mensagem" });
    }
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