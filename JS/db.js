require("dotenv").config();

const { Pool, types } = require("pg");

types.setTypeParser(20, (value) => {
    const numero = Number(value);
    return Number.isSafeInteger(numero) ? numero : value;
});

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

const connectionString = process.env.DATABASE_URL;
const ssl = process.env.DB_SSL === "false"
    ? false
    : { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false" };

const config = connectionString
    ? { connectionString, ssl }
    : {
        host: process.env.DB_HOST || process.env.PGHOST || process.env.host || "localhost",
        port: Number(process.env.DB_PORT || process.env.PGPORT || process.env.port || 5432),
        user: process.env.DB_USER || process.env.PGUSER || process.env.user || "postgres",
        password: process.env.DB_PASSWORD || process.env.PGPASSWORD || process.env.password || "",
        database: process.env.DB_NAME || process.env.PGDATABASE || process.env.database || "postgres",
        ssl
    };

const poolPostgres = new Pool({
    ...config,
    max: 10,
    connectionTimeoutMillis: 10000
});

const pool = {
    execute(sql, parametros) {
        return criarExecutor(poolPostgres).execute(sql, parametros);
    },
    async getConnection() {
        return criarExecutor(await poolPostgres.connect());
    }
};

poolPostgres.connect()
    .then((conexao) => {
        console.log("Conectado ao banco de dados PostgreSQL/Supabase.");
        conexao.release();
    })
    .catch((error) => {
        console.error("Erro ao conectar no banco de dados PostgreSQL:", error.message);
    });

module.exports = pool;
