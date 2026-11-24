/*
===============================================
1 PARTE - CONFIGURAR O SERVIDOR
===============================================
*/
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const pool = require("./db.js");

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
const { criarManipuladorExclusao } = require("./exclusao-conta.js");
const paginasProtegidas = ["aluno.html", "educador.html", "salas.html", "turmas.html", "turma.html", "atividades.html", "avaliacoes.html", "aluno-atividades.html", "professor-correcao.html", "nova-atividade.html", "nova-avaliacao.html", "perfil-aluno.html", "perfil-educador.html", "boletim.html", "bate-papo.html"];

// Cria a instância principal do servidor Express
const app = express();
const httpServer = http.createServer(app);

// 2) Pool de conexão com o banco de dados PostgreSQL/Supabase
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
    "https://daniloakin07-boop.github.io" ,
    "https://conrad-phi.vercel.app"
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
app.use(express.json({ limit: "2mb" }));

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
// Bloqueia arquivos internos que não devem ser acessados pelo navegador
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
    "/js/exclusao-conta.js",
    "/js/utilitarios-banco.js",
];

app.use((req, res, next) => {
    const caminhoMinusculo = req.path.toLowerCase();

    if (
        arquivosBloqueados.includes(caminhoMinusculo) ||
        caminhoMinusculo.startsWith("/js/migrations")
    ) {
        return res.status(404).send("Not found");
    }

    // ESSENCIAL: permite que a requisição continue para as próximas rotas
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

        const emailNormalizado = String(email).trim().toLowerCase();

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
            "SELECT id FROM tb_usuarios WHERE LOWER(email) = ?", [emailNormalizado]
        );

        if (existentes.length > 0) {
            return res.status(409).json({ erro: "E-mail já cadastrado" });
        }

        // Hash da senha antes de salvar (boa prática de segurança)
        const senhaHash = await bcrypt.hash(senha, 10);

        // Insere o usuário no banco e obtém o `insertId`
        const [resultado] = await pool.execute(
            "INSERT INTO tb_usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, ?)",
            [nome, emailNormalizado, senhaHash, tipoBanco]
        );

        // Salva apenas dados não sensíveis na sessão (não guardar senha)
        req.session.usuario = {
            id: resultado.insertId,
            nome: nome,
            email: emailNormalizado,
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

        const emailNormalizado = String(email).trim().toLowerCase();

        // Busca o usuário pelo e-mail
        const [linhas] = await pool.execute(
            "SELECT id, nome, email, senha, tipo FROM tb_usuarios WHERE LOWER(email) = ?", [emailNormalizado]
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
// Retorna se o usuário está logado e seus dados básicos.
// Também confere no banco se a conta ainda existe: se ela foi excluída em outro dispositivo, a
// sessão antiga é encerrada aqui (evita "usuário fantasma" depois de DELETE /conta).
app.get("/me", async (req, res) => {
    if (!req.session.usuario) {
        return res.status(401).json({ logado: false });
    }

    try {
        const [contas] = await pool.execute("SELECT id FROM tb_usuarios WHERE id = ? LIMIT 1", [req.session.usuario.id]);
        if (!contas.length) {
            return req.session.destroy(() => {
                res.clearCookie("conrad.sid");
                res.status(401).json({ logado: false });
            });
        }
    } catch (erro) {
        // Falha momentânea do banco não deve derrubar a sessão: segue com os dados da sessão
        console.error("Erro ao validar a conta em /me:", erro.message);
    }

    res.json({
        logado: true,
        usuario: req.session.usuario
    });
});

// Dados complementares do perfil. A tabela é criada automaticamente na primeira utilização.
let tabelaPerfisPromise = null;
async function garantirTabelaPerfis() {
    if (!tabelaPerfisPromise) {
        tabelaPerfisPromise = pool.execute(`
            CREATE TABLE IF NOT EXISTS tb_perfis_alunos (
                usuario_id BIGINT PRIMARY KEY REFERENCES tb_usuarios(id) ON DELETE CASCADE,
                sobre_mim VARCHAR(800) NULL,
                interesses TEXT NULL,
                habilidades TEXT NULL,
                foto_perfil TEXT NULL,
                atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `).catch((erro) => {
            tabelaPerfisPromise = null;
            throw erro;
        });
    }
    await tabelaPerfisPromise;
}

function lerListaPerfil(valor) {
    if (!valor) return [];
    try {
        const lista = JSON.parse(valor);
        return Array.isArray(lista) ? lista : [];
    } catch {
        return [];
    }
}

function normalizarListaPerfil(valor) {
    const itens = Array.isArray(valor) ? valor : typeof valor === "string" ? valor.split(/[,;\n]+/) : [];
    return [...new Set(itens
        .map((item) => String(item).trim().slice(0, 40))
        .filter(Boolean))].slice(0, 12);
}

// Consulta os dados da conta e as informações de apresentação do estudante logado.
app.get("/perfil", async (req, res) => {
    if (!req.session.usuario) return res.status(401).json({ erro: "Faça login para continuar" });

    try {
        await garantirTabelaPerfis();
        const usuarioId = req.session.usuario.id;
        const [usuarios] = await pool.execute(
            "SELECT id, nome, email, tipo FROM tb_usuarios WHERE id = ? LIMIT 1",
            [usuarioId]
        );
        if (!usuarios.length) return res.status(404).json({ erro: "Conta não encontrada" });

        const [perfis] = await pool.execute(
            "SELECT sobre_mim, interesses, habilidades, foto_perfil FROM tb_perfis_alunos WHERE usuario_id = ? LIMIT 1",
            [usuarioId]
        );
        const dados = perfis[0] || {};
        res.json({
            usuario: usuarios[0],
            perfil: {
                sobre_mim: dados.sobre_mim || "",
                interesses: lerListaPerfil(dados.interesses),
                habilidades: lerListaPerfil(dados.habilidades),
                foto_perfil: dados.foto_perfil || ""
            }
        });
    } catch (erro) {
        console.error("Erro ao carregar perfil:", erro);
        res.status(500).json({ erro: "Não foi possível carregar seu perfil" });
    }
});

// Atualiza os dados da conta e as informações complementares do perfil.
app.put("/perfil", async (req, res) => {
    if (!req.session.usuario) return res.status(401).json({ erro: "Faça login para continuar" });

    try {
        const usuarioId = req.session.usuario.id;
        const nome = String(req.body.nome || "").trim();
        const email = String(req.body.email || "").trim().toLowerCase();
        const sobreMim = String(req.body.sobre_mim || "").trim();
        const interesses = normalizarListaPerfil(req.body.interesses);
        const habilidades = normalizarListaPerfil(req.body.habilidades);
        const foto = req.body.foto_perfil == null ? "" : String(req.body.foto_perfil);

        if (!nome || nome.length > 100) {
            return res.status(400).json({ erro: "Informe um nome com até 100 caracteres" });
        }
        if (!email || email.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ erro: "Informe um endereço de e-mail válido" });
        }
        if (sobreMim.length > 800) {
            return res.status(400).json({ erro: "A apresentação deve ter no máximo 800 caracteres" });
        }
        if (foto && (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(foto) || foto.length > 1500000)) {
            return res.status(400).json({ erro: "A foto é inválida ou ultrapassa o tamanho permitido" });
        }

        await garantirTabelaPerfis();
        const conexao = await pool.getConnection();
        try {
            await conexao.beginTransaction();
            const [emails] = await conexao.execute(
                "SELECT id FROM tb_usuarios WHERE LOWER(email) = LOWER(?) AND id <> ? LIMIT 1",
                [email, usuarioId]
            );
            if (emails.length) {
                await conexao.rollback();
                return res.status(409).json({ erro: "Esse e-mail já está sendo usado por outra conta" });
            }

            await conexao.execute(
                "UPDATE tb_usuarios SET nome = ?, email = ? WHERE id = ?",
                [nome, email, usuarioId]
            );
            await conexao.execute(
                `INSERT INTO tb_perfis_alunos (usuario_id, sobre_mim, interesses, habilidades, foto_perfil)
                 VALUES (?, ?, ?, ?, ?)
                 ON CONFLICT (usuario_id) DO UPDATE SET
                    sobre_mim = EXCLUDED.sobre_mim,
                    interesses = EXCLUDED.interesses,
                    habilidades = EXCLUDED.habilidades,
                    foto_perfil = EXCLUDED.foto_perfil,
                    atualizado_em = NOW()`,
                [usuarioId, sobreMim || null, JSON.stringify(interesses), JSON.stringify(habilidades), foto || null]
            );
            await conexao.commit();
        } catch (erroTransacao) {
            await conexao.rollback().catch(() => {});
            if (erroTransacao.code === "23505") {
                return res.status(409).json({ erro: "Esse e-mail já está sendo usado por outra conta" });
            }
            throw erroTransacao;
        } finally {
            conexao.release();
        }

        req.session.usuario.nome = nome;
        req.session.usuario.email = email;
        res.json({
            mensagem: "Perfil atualizado com sucesso",
            usuario: { id: usuarioId, nome, email, tipo: req.session.usuario.tipo },
            perfil: {
                sobre_mim: sobreMim,
                interesses,
                habilidades,
                foto_perfil: foto
            }
        });
    } catch (erro) {
        console.error("Erro ao atualizar perfil:", erro);
        res.status(500).json({ erro: "Não foi possível salvar seu perfil" });
    }
});

// Exclusão DEFINITIVA da própria conta (Web e Mobile). Exige sessão + senha atual no corpo: { senha }.
// O ID excluído é sempre o da sessão. Toda a regra (transação, política de dados dos alunos,
// educadores e conversas) está em JS/exclusao-conta.js.
const { maxAge: _ignorado, ...atributosCookie } = sessionConfig.cookie;
app.delete("/conta", criarManipuladorExclusao({
    pool,
    bcrypt,
    nomeCookie: sessionConfig.name,
    opcoesCookie: atributosCookie
}));

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
