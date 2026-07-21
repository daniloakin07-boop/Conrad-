/*
===============================================
CONEXÃO COM O BANCO DE DADOS (MySQL)
===============================================
*/
// Carrega variáveis de ambiente (.env) usadas para configurar a conexão
// Ex.: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT
require("dotenv").config();

// Este arquivo exporta um `pool` do mysql2/promise para que o servidor
// possa executar consultas SQL usando async/await.
// O pool facilita o reaproveitamento de conexões e melhora a performance.

// 1. Importar o mysql2 no formato promise
const mysql = require("mysql2/promise");

// 1.1. Importar fs e path para ler arquivos locais, como o certificado SSL
const fs = require("fs");
const path = require("path");

// 1.2. Localiza o certificado CA que o banco pode exigir para conexões seguras
const caminhoCertificado = path.join(__dirname, "ca.pem");
const certificadoCA = fs.existsSync(caminhoCertificado)
    ? fs.readFileSync(caminhoCertificado)
    : undefined;

// 2. Cria o pool de conexões com o banco de dados
const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "conrad",
    ssl: certificadoCA
        ? { ca: certificadoCA }             // Usa certificado CA se existir
        : { rejectUnauthorized: false },    // Em teste local, desativa validação SSL
    waitForConnections: true, // Aguarda conexão livre quando o pool está cheio
    connectionLimit: 10,      // Máximo de conexões simultâneas no pool
    queueLimit: 0             // 0 = fila de espera ilimitada para conexões
});

// 3. Testa a conexão ao iniciar o servidor para avisar se o banco está OK
pool.getConnection()
    .then((conexao) => {
        console.log("Conectado ao banco de dados MySQL!");
        conexao.release(); // devolve a conexão ao pool para uso posterior
    })
    .catch((error) => {
        console.error("Erro ao conectar no banco de dados:", error.message);
    });

// 4. Exporta o pool para ser usado em outras partes da aplicação
module.exports = pool;