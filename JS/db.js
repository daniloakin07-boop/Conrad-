/*
===============================================
CONEXÃO COM O BANCO DE DADOS (MySQL)
===============================================
*/
// Importar as variáveis de ambiente
require("dotenv").config();

// 1. Importar o mysql2 no formato "promise" - permite usar async/await
const mysql = require("mysql2/promise");

// 1.1. Importar o fs e o path - para ler o certificado do banco
const fs = require("fs");
const path = require("path");

// 1.2. Carrega o certificado CA do Aiven (baixado no painel do banco)
const caminhoCertificado = path.join(__dirname, "ca.pem");
const certificadoCA = fs.existsSync(caminhoCertificado)
    ? fs.readFileSync(caminhoCertificado)
    : undefined;

// 2. Cria o pool de conexões com o banco
// Um "pool" mantém várias conexões abertas e prontas, em vez de abrir
// e fechar uma conexão nova a cada consulta (mais rápido e mais seguro)
const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "conrad",
    ssl: certificadoCA
        ? { ca: certificadoCA }             // valida usando o certificado do Aiven
        : { rejectUnauthorized: false },    // sem o certificado ainda: conecta sem validar (só p/ teste rápido)
    waitForConnections: true, // espera uma conexão livre em vez de dar erro na hora
    connectionLimit: 10,      // quantidade máxima de conexões simultâneas
    queueLimit: 0             // 0 = fila de espera sem limite
});

// 3. Testa a conexão assim que o servidor sobe, só pra dar um aviso no console
pool.getConnection()
    .then((conexao) => {
        console.log("Conectado ao banco de dados MySQL!");
        conexao.release(); // devolve a conexão pro pool
    })
    .catch((error) => {
        console.error("Erro ao conectar no banco de dados:", error.message);
    });

// 4. Exporta o pool para ser usado nas rotas do server.js
module.exports = pool;