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
const http = require("http");
const cors = require("cors");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const { Server } = require("socket.io");
const mediasRoutes = require("./medias.js");
const chat = require("./chat.js");
const paginasProtegidas = ["aluno.html", "educador.html", "salas.html", "turmas.html", "turma.html", "atividades.html", "avaliacoes.html", "aluno-atividades.html", "professor-correcao.html", "nova-atividade.html", "nova-avaliacao.html", "perfil-aluno.html", "perfil-educador.html", "boletim.html", "bate-papo.html"];

// Cria a instância principal do servidor Express
const app = express();
const httpServer = http.createServer(app);

// 2) Pool de conexão com o banco de dados
// O arquivo `JS/db.js` exporta um pool mysql2 que o servidor usa para executar queries
const pool = require("./db.js");

// 3) Origens permitidas para CORS
// Lista de endereços que podem acessar a API via browser (evita requests não autorizados)
const listOrigins = [
    "http://localhost:5500", // Live Server
    "http://127.0.0.1:5500",
    "http://localhost:5501", // Live Server / previews locais
    "http://127.0.0.1:5501",
    "http://localhost:5502",
    "http://127.0.0.1:5502",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://conrad-1.onrender.com", // Servidor publicado no Render
    "https://conrad.onrender.com",
    "https://daniloakin07-boop.github.io"
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
    app.set("trust proxy", 1); // o Render fica na frente do app como proxy reverso
    sessionConfig.cookie.sameSite = "none"; // permite envio cross-site
    sessionConfig.cookie.secure = true; // só envia cookie via HTTPS
} else {
    // Em desenvolvimento local, lembre-se de não exigir HTTPS
    sessionConfig.cookie.sameSite = "lax";
    sessionConfig.cookie.secure = false;
}

// Ativa o middleware de sessão com a configuração definida acima.
// A mesma instância também será compartilhada com o Socket.IO.
const sessionMiddleware = session(sessionConfig);
app.use(sessionMiddleware);

// Rotas do bate-papo privado (a sessão identifica quem está acessando).
app.use("/api/chat", chat.router);

// Rotas de médias e boletim: ficam depois da sessão para validar o estudante autenticado.
app.use("/api", mediasRoutes);

// Atividades, provas, entregas e notas (professor <-> aluno)
const atividadesRoutes = require("./atividades.js");
app.use("/api", atividadesRoutes);

// Turmas, códigos de convite, matrículas e acesso às salas de vídeo.
const turmasRoutes = require("./turmas.js");
app.use("/api", turmasRoutes);

// Socket.IO mantém uma conexão aberta e transmite mensagens em tempo real.
// A lista de origens deve conter apenas os endereços realmente usados pelo site.
const io = new Server(httpServer, {
    cors: {
        origin: listOrigins,
        credentials: true
    },
    // Imagens/áudios de até 3 MB chegam codificados em Base64.
    maxHttpBufferSize: 5 * 1024 * 1024
});

// Permite que os eventos do chat conheçam o usuário autenticado na sessão.
// O middleware do Engine.IO roda antes de o Socket.IO criar o socket.
io.engine.use(sessionMiddleware);

// Registra as salas privadas e os eventos do bate-papo individual.
chat.configurarSocket(io);

// 8) Rotas que exigem sessão (ex.: páginas internas)
// Middleware para checar acesso às páginas estáticas protegidas
app.get("/pages/:pagina", async function (req, res, next) {
    const usuario = req.session.usuario;
    if (paginasProtegidas.includes(req.params.pagina) && !usuario) {
        // Se não estiver logado, redireciona para login
        return res.redirect("/pages/login.html");
    }

    if (req.params.pagina === "aluno.html" && usuario?.tipo !== "educador") {
        const turmaId = req.query.turmaId ? Number(req.query.turmaId) : null;
        if (turmaId !== null && (!Number.isInteger(turmaId) || turmaId <= 0)) {
            return res.redirect("/pages/turmas.html");
        }

        try {
            const [matriculas] = await pool.execute(
                turmaId
                    ? "SELECT id FROM tb_turma_alunos WHERE aluno_id = ? AND turma_id = ? LIMIT 1"
                    : "SELECT id FROM tb_turma_alunos WHERE aluno_id = ? LIMIT 1",
                turmaId ? [usuario.id, turmaId] : [usuario.id]
            );
            if (!matriculas.length) return res.redirect("/pages/turmas.html");
        } catch (erro) {
            console.error("Erro ao validar acesso ao painel do aluno:", erro);
            return res.status(503).send("Não foi possível validar sua matrícula. Tente novamente.");
        }
    }

    next();
});

// 9) Bloqueia arquivos internos que não devem ser baixados pelo navegador
// Como o `express.static` serve a pasta-pai inteira, sem isso o código do
// servidor e o package.json ficariam acessíveis por URL.
const arquivosBloqueados = [
    "/js/server.js",
    "/js/db.js",
    "/js/medias.js",
    "/js/atividades.js",
    "/js/turmas.js",
    "/js/ca.pem",
    "/package.json",
    "/package-lock.json",
    "/js/chat.js",
];

app.use((req, res, next) => {
    const caminhoMinusculo = req.path.toLowerCase();

    if (
        arquivosBloqueados.includes(caminhoMinusculo) ||
        caminhoMinusculo.startsWith("/js/migrations")
    ) {
        return res.status(404).send("Not found");
    }

    // Permite que o restante do servidor continue funcionando.
    next();
});

// 10) Servir arquivos estáticos (HTML, CSS, imagens, JS do front-end)
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

        if (typeof senha !== "string" || senha.length < 6) {
            return res.status(400).json({ erro: "A senha deve ter no mínimo 6 caracteres." });
        }

        // O formulário pode enviar "estudante"; o banco guarda "aluno"
        const tipoBanco = tipo === "estudante" ? "aluno" : tipo;
        if (!["aluno", "educador"].includes(tipoBanco)) {
            return res.status(400).json({ erro: "Tipo de usuário inválido" });
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
            [nome, email, senhaHash, tipoBanco]
        );

        // Salva apenas dados não sensíveis na sessão (não guardar senha)
        req.session.usuario = {
            id: resultado.insertId,
            nome: nome,
            email: email,
            tipo: tipoBanco
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

// Porta do servidor (padrão 3000) — o Render define a PORT automaticamente
const PORT = process.env.PORT || 3000;

// Se este arquivo foi executado diretamente (e não importado), inicia o servidor
if (require.main === module) {
    httpServer.listen(PORT, () => {
        console.log(`Servidor rodando na porta ${PORT}`);
    });
}

// Exporta a instância `app` para testes ou uso por outros módulos
module.exports = app;
