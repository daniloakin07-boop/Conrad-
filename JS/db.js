/*
===============================================
JS/db.js  (BACKEND — conexão com o banco PostgreSQL/Supabase)
===============================================
Cria o pool de conexões usado por todas as rotas (server.js, atividades.js, turmas.js,
medias.js, chat.js). Exporta um objeto com a MESMA interface do pacote "mysql2/promise"
(execute, getConnection, beginTransaction, commit, rollback, release) para que o restante
do código escreva SQL com marcadores "?" e leia resultados como [linhas, metadados].

Configuração (variáveis de ambiente, lidas do .env — nunca versionar valores reais):
  DATABASE_URL                            string de conexão completa (opcional); se existir, tem prioridade
  DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME   alternativa campo a campo
  DB_SSL=false                            desliga SSL (padrão: SSL ligado)
  DB_SSL_REJECT_UNAUTHORIZED=false        aceita certificados não verificados
*/

require("dotenv").config();

// `pg` é o driver oficial do PostgreSQL para Node.js
const { Pool, types } = require("pg");
const fs = require("fs");
const path = require("path");

// BIGINT (tipo 20) chega do PostgreSQL como texto; converte para número quando cabe com segurança
types.setTypeParser(20, (value) => {
    const numero = Number(value);
    return Number.isSafeInteger(numero) ? numero : value;
});

/**
 * Adapta o SQL escrito no estilo MySQL para o PostgreSQL:
 *  - troca cada "?" por $1, $2, ... (marcadores posicionais do `pg`);
 *  - coloca aspas em aliases com letra maiúscula (AS dataAplicacao -> AS "dataAplicacao"),
 *    pois o PostgreSQL converteria o alias para minúsculas;
 *  - acrescenta RETURNING * nos INSERT, para obter o id criado (insertId).
 */
function converterConsulta(sql) {
    let indice = 0;
    let consulta = sql.replace(/\?/g, () => `$${++indice}`);
    consulta = consulta.replace(
        /\bAS\s+([a-z_][a-z0-9_]*[A-Z][A-Za-z0-9_]*)/g,
        'AS "$1"'
    );

    if (/^\s*INSERT\b/i.test(consulta) && !/\bRETURNING\b/i.test(consulta)) {
        consulta += " RETURNING *";
    }

    return consulta;
}

/**
 * Envolve uma conexão do `pg` na interface esperada pelas rotas.
 * execute(sql, parametros): SELECT/WITH -> [linhas, resultado]; demais comandos ->
 * [{ insertId, affectedRows }, resultado]. Também expõe beginTransaction/commit/rollback/release.
 */
function criarExecutor(conexao) {
    return {
        async execute(sql, parametros = []) {
            const resultado = await conexao.query(converterConsulta(sql), parametros);
            if (/^\s*(SELECT|WITH)\b/i.test(sql)) {
                return [resultado.rows, resultado];
            }

            return [{
                insertId: resultado.rows[0]?.id,
                affectedRows: resultado.rowCount
            }, resultado];
        },
        async beginTransaction() {
            await conexao.query("BEGIN");
        },
        async commit() {
            await conexao.query("COMMIT");
        },
        async rollback() {
            await conexao.query("ROLLBACK");
        },
        release() {
            conexao.release();
        }
    };
}

// Escolhe como conectar: DATABASE_URL ou campos separados
const connectionString = process.env.DATABASE_URL;

function criarSSL(host = process.env.DB_HOST) {
    if (process.env.DB_SSL === "false") return false;

    const ssl = {
        rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false",
        servername: host || undefined
    };

    if (process.env.DB_SSL_CA_PATH) {
        const caminho = path.resolve(process.cwd(), process.env.DB_SSL_CA_PATH);
        if (fs.existsSync(caminho)) {
            ssl.ca = fs.readFileSync(caminho);
            ssl.rejectUnauthorized = true;
        } else {
            console.warn(`Certificado TLS não encontrado: ${caminho}`);
        }
    }

    return ssl;
}

let databaseHost = process.env.DB_HOST;
if (connectionString) {
    try {
        databaseHost = new URL(connectionString).hostname;
    } catch {}
}

const ssl = criarSSL(databaseHost);

const config = connectionString
    ? { connectionString, ssl }
    : {
        host: process.env.DB_HOST || process.env.PGHOST || process.env.host || "localhost",
        port: Number(process.env.DB_PORT || process.env.PGPORT || process.env.port || 5432),
        user: process.env.DB_USER || process.env.PGUSER || process.env.user || "postgres",
        password: String(process.env.DB_PASSWORD || process.env.PGPASSWORD || process.env.password || "").trim(),
        database: process.env.DB_NAME || process.env.PGDATABASE || process.env.database || "postgres",
        ssl
    };

// Pool real do `pg`: no máximo 10 conexões simultâneas e 10 s de espera para conectar
const poolPostgres = new Pool({
    ...config,
    max: 10,
    connectionTimeoutMillis: 10000
});

// Objeto exportado: `execute` usa uma conexão do pool por consulta; `getConnection` reserva uma
// conexão (necessário para transações — lembre-se de chamar release()).
const pool = {
    execute(sql, parametros) {
        return criarExecutor(poolPostgres).execute(sql, parametros);
    },
    async getConnection() {
        return criarExecutor(await poolPostgres.connect());
    }
};

// Teste de conexão no início: só registra no terminal se deu certo ou erro (não derruba o servidor)
poolPostgres.connect()
    .then((conexao) => {
        console.log("Conectado ao banco de dados PostgreSQL/Supabase.");
        conexao.release();
    })
    .catch((error) => {
        console.error("Erro ao conectar no banco de dados PostgreSQL:", error.message);
    });

module.exports = pool;
