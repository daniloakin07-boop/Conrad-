const express = require("express");
const path = require("path");
const cors = require("cors");
const bcrypt = require("bcryptjs");

const app = express();
const usuarios = [];
const contatos = [];

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "..")));

app.get("/", function (req, res) {
    res.redirect("/pages/index.html");
});

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
            nome,
            email,
            senha: senhaHash,
            tipo
        };

        usuarios.push(usuario);
        res.status(201).json({ mensagem: "Cadastro realizado com sucesso!" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: "Erro ao cadastrar usuário" });
    }
});

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

        res.json({ mensagem: "Login realizado com sucesso!", usuario });
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: "Erro ao fazer login" });
    }
});

app.post("/contato", (req, res) => {
    const { nome, email, mensagem } = req.body;

    if (!nome || !email || !mensagem) {
        return res.status(400).json({ erro: "Todos os campos são obrigatórios." });
    }

    const contato = {
        id: contatos.length + 1,
        nome,
        email,
        mensagem
    };

    contatos.push(contato);
    res.status(201).json({ id: contato.id });
});

app.get("/health", (req, res) => {
    res.json({ status: "ok" });
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Servidor rodando na porta ${PORT}`);
    });
}

module.exports = app;