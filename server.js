const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');

const app = express();
const dbFile = path.join(__dirname, 'conrad.db');
const db = new sqlite3.Database(dbFile);

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

// Cria tabelas se não existirem
const schema = `
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  senha TEXT NOT NULL,
  tipo TEXT NOT NULL,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contatos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

db.exec(schema, (err) => {
  if (err) {
    console.error('Erro ao criar tabelas:', err);
    process.exit(1);
  }
});

app.post('/cadastro', (req, res) => {
  const { nome, email, senha, tipo } = req.body;

  if (!nome || !email || !senha || !tipo) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
  }

  const sql = 'INSERT INTO usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, ?)';
  db.run(sql, [nome, email, senha, tipo], function (err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(409).json({ error: 'E-mail já cadastrado.' });
      }
      return res.status(500).json({ error: 'Erro ao criar usuário.' });
    }

    return res.status(201).json({ id: this.lastID, nome, email, tipo });
  });
});

app.post('/login', (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
  }

  const sql = 'SELECT id, nome, email, tipo FROM usuarios WHERE email = ? AND senha = ?';
  db.get(sql, [email, senha], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao verificar credenciais.' });
    }
    if (!row) {
      return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
    }

    return res.json({ user: row });
  });
});

app.post('/contato', (req, res) => {
  const { nome, email, mensagem } = req.body;

  if (!nome || !email || !mensagem) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
  }

  const sql = 'INSERT INTO contatos (nome, email, mensagem) VALUES (?, ?, ?)';
  db.run(sql, [nome, email, mensagem], function (err) {
    if (err) {
      return res.status(500).json({ error: 'Erro ao enviar a mensagem.' });
    }
    return res.status(201).json({ id: this.lastID });
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
