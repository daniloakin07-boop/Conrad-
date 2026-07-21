/*
===============================================
1 PARTE - CONFIGURAR O SERVIDOR
===============================================
*/

// Carrega variáveis de ambiente do arquivo .env (se existir)
// Ex.: PORT=3000, SESSION_SECRET=chave
require("dotenv").config();

// 1) Importar bibliotecas principais
// - express: framework web para criar o servidor e rotas
// - path: utilitário para montar caminhos de arquivos com segurança
// - cors: middleware para permitir/restringir origens HTTP
// - express-session: gerencia sessões por cookie no navegador
// - bcryptjs: utilitário para hashear e comparar senhas com segurança
const express = require("express");
const path = require("path");
const cors = require("cors");
const session = require("express-session");
const bcrypt = require("bcryptjs");

// Cria a instância principal do servidor Express
const app = express();

// 2) Pool de conexão com o banco de dados
// O arquivo `JS/db.js` exporta um pool mysql2 que o servidor usa para executar queries
const pool = require("./db.js");

// 3) Origens permitidas para CORS
// Lista de endereços que podem acessar a API via browser (evita requests não autorizados)
const listOrigins = [
    "http://localhost:5501", // Live Server / previews locais
    "http://127.0.0.1:5501",
    "http://localhost:3000"  // quando servimos arquivos estáticos localmente
];

// 4) Configurar CORS
// - `origin` limita quem pode chamar a API
// - `credentials: true` permite enviar cookies com as requisições
app.use(cors({
    origin: listOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

// 5) Middleware para interpretar JSON no corpo das requisições
// Sem isso, `req.body` ficaria undefined ao receber JSON do front-end.
app.use(express.json());

// 6) Middleware simples de log para depuração
// Exibe no terminal cada requisição recebida: método e caminho
app.use((req, res, next) => {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
    next();
});

// 7) Configuração das sessions (cookies de sessão)
// - `secret` assina/encripta o cookie
// - `resave` e `saveUninitialized` controlam quando o session é salvo
// - `name` é o nome do cookie que o navegador recebe
// - `cookie` ajusta segurança e validade do cookie
const sessionConfig = {
    secret: process.env.SESSION_SECRET || "segredo-conrad",
    resave: false,
    saveUninitialized: false,
    name: "conrad.sid",
    cookie: {
        httpOnly: true, // impede acesso ao cookie via JavaScript do cliente
        maxAge: 1000 * 60 * 60 // 1 hora em milissegundos
    }
};

// Em produção, precisamos de configurações de cookie mais seguras
if (process.env.NODE_ENV == "production") {
    app.set("trust proxy", 1); // se o app estiver atrás de um proxy reverso
    sessionConfig.cookie.sameSite = "none"; // permite envio cross-site
    sessionConfig.cookie.secure = true; // só envia cookie via HTTPS
} else {
    // Em desenvolvimento local, lembre-se de não exigir HTTPS
    sessionConfig.cookie.sameSite = "lax";
    sessionConfig.cookie.secure = false;
}

// Ativa o middleware de sessão com a configuração definida acima
app.use(session(sessionConfig));

// 8) Rotas que exigem sessão (ex.: páginas internas)
// `paginasProtegidas` lista arquivos HTML que devem exigir login
const paginasProtegidas = ["aluno.html", "educador.html"];

// Middleware para checar acesso às páginas estáticas protegidas
app.get("/pages/:pagina", function (req, res, next) {
    if (paginasProtegidas.includes(req.params.pagina) && !req.session.usuario) {
        // Se não estiver logado, redireciona para login
        return res.redirect("/pages/login.html");
    }
    next();
});

// 9) Servir arquivos estáticos (HTML, CSS, imagens, JS do front-end)
// `express.static` mapeia a pasta-pai do projeto para requisições HTTP
app.use(express.static(path.join(__dirname, "..")));

/*
===============================================
2 PARTE - CRIAR ROTAS (API)
===============================================
*/

// Rota raiz: redireciona para a página inicial do site
app.get("/", function (req, res) {
    res.redirect("/pages/index.html");
});

// Rota de cadastro: cria um novo usuário no banco
// Recebe JSON com `{ nome, email, senha, tipo }`
app.post("/cadastro", async (req, res) => {
    try {
        const { nome, email, senha, tipo } = req.body;

        // Validação básica de entrada
        if (!nome || !email || !senha || !tipo) {
            return res.status(400).json({ erro: "Preencha todos os campos" });
        }

        // Verifica se o e-mail já existe na tabela `tb_usuarios`
        const [existentes] = await pool.execute(
            "SELECT id FROM tb_usuarios WHERE email = ?", [email]
        );

        if (existentes.length > 0) {
            return res.status(409).json({ erro: "E-mail já cadastrado" });
        }

        // Hash da senha antes de salvar (boa prática de segurança)
        const senhaHash = await bcrypt.hash(senha, 10);

        // Insere o usuário no banco e obtém o `insertId`
        const [resultado] = await pool.execute(
            "INSERT INTO tb_usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, ?)",
            [nome, email, senhaHash, tipo]
        );

        // Salva apenas dados não sensíveis na sessão (não guardar senha)
        req.session.usuario = {
            id: resultado.insertId,
            nome: nome,
            email: email,
            tipo: tipo
        };

        // Resposta com 201 (criado)
        res.status(201).json({ mensagem: "Cadastro realizado com sucesso!", usuario: req.session.usuario });
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: "Erro ao cadastrar usuário" });
    }
});

// Rota de login: valida usuário e senha
// Recebe `{ email, senha }` e compara com o hash armazenado no banco
app.post("/login", async (req, res) => {
    try {
        const { email, senha } = req.body;

        if (!email || !senha) {
            return res.status(400).json({ erro: "Preencha todos os campos" });
        }

        // Busca o usuário pelo e-mail
        const [linhas] = await pool.execute(
            "SELECT id, nome, email, senha, tipo FROM tb_usuarios WHERE email = ?", [email]
        );

        if (linhas.length === 0) {
            return res.status(401).json({ erro: "Usuário não encontrado" });
        }

        const usuario = linhas[0];

        // Compara senha enviada com o hash armazenado
        const senhaCorreta = await bcrypt.compare(senha, usuario.senha);

        if (!senhaCorreta) {
            return res.status(401).json({ erro: "Senha inválida" });
        }

        // Armazena dados não sensíveis na sessão
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

// Rota para verificar sessão do usuário atual
// Retorna se o usuário está logado e seus dados básicos
app.get("/me", (req, res) => {
    if (!req.session.usuario) {
        return res.status(401).json({ logado: false });
    }

    res.json({
        logado: true,
        usuario: req.session.usuario
    });
});

// Rota de logout: destrói a sessão e limpa o cookie no navegador
app.post("/logout", (req, res) => {
    req.session.destroy(() => {
        res.clearCookie("conrad.sid");
        res.json({ mensagem: "Logout realizado" });
    });
});

// Rota de contato: armazena mensagens de usuários no banco
// Recebe `{ nome, email, mensagem }`
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

// Rota simples para checar se a API está ativa
app.get("/health", (req, res) => {
    res.json({ status: "ok" });
});

/*
===============================================
3 PARTE - INICIAR O SERVIDOR
===============================================
*/

// Porta do servidor (padrão 3000) — pode ser sobrescrita por variável de ambiente
const PORT = process.env.PORT || 3000;

// Se este arquivo foi executado diretamente (e não importado), inicia o servidor
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Servidor rodando na porta ${PORT}`);
    });
}

// Exporta a instância `app` para testes ou uso por outros módulos
module.exports = app;