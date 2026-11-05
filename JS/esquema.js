/*
===============================================
TABELAS E COLUNAS DAS QUESTÕES (criadas sozinhas ao iniciar o servidor)
===============================================
As atividades com questões, tempo limite e correção por questão precisam de 3 tabelas novas
e de uma coluna em tb_atividades. Para o recurso não quebrar se alguém esquecer de rodar a
migração, o servidor confere e cria o que faltar sempre que inicia. Não apaga nem altera dado.

O mesmo conteúdo está em JS/migrations/005-questoes-e-tempo.sql, para quem preferir rodar
na mão ou não der permissão de CREATE/ALTER ao usuário do banco (nesse caso o servidor só
avisa no terminal).

Sem chaves estrangeiras de propósito: o tipo das colunas de id varia entre as migrações
antigas, e uma chave estrangeira com tipos diferentes é recusada pelo MySQL.
*/

const TABELAS = [
    {
        nome: "tb_questoes",
        sql: `CREATE TABLE IF NOT EXISTS tb_questoes (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            atividade_id BIGINT UNSIGNED NOT NULL,
            ordem INT NOT NULL,
            tipo VARCHAR(20) NOT NULL,
            enunciado TEXT NOT NULL,
            pontos DECIMAL(7,2) NOT NULL DEFAULT 1.00,
            alternativas TEXT NULL,
            correta INT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY uq_questoes_atividade_ordem (atividade_id, ordem)
        )`
    },
    {
        nome: "tb_respostas",
        sql: `CREATE TABLE IF NOT EXISTS tb_respostas (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            entrega_id BIGINT UNSIGNED NOT NULL,
            questao_id BIGINT UNSIGNED NOT NULL,
            resposta TEXT NULL,
            alternativa INT NULL,
            pontos DECIMAL(7,2) NULL,
            comentario TEXT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY uq_respostas_entrega_questao (entrega_id, questao_id),
            INDEX idx_respostas_questao (questao_id)
        )`
    },
    {
        // Momento em que o aluno clicou em "Iniciar" (em milissegundos, calculado pelo servidor).
        // Guardado como número, e não como DATETIME, para o fuso horário do banco não bagunçar o cronômetro.
        nome: "tb_inicios",
        sql: `CREATE TABLE IF NOT EXISTS tb_inicios (
            atividade_id BIGINT UNSIGNED NOT NULL,
            aluno_id BIGINT UNSIGNED NOT NULL,
            iniciada_ms BIGINT UNSIGNED NOT NULL,
            PRIMARY KEY (atividade_id, aluno_id)
        )`
    }
];

const COLUNAS = [
    { tabela: "tb_atividades", coluna: "tempo_limite_min", definicao: "INT NULL" },
    // Estas duas já vinham das migrações 003/004; conferir aqui evita erro em bancos antigos.
    { tabela: "tb_atividades", coluna: "avaliativa", definicao: "TINYINT(1) NOT NULL DEFAULT 0" },
    { tabela: "tb_atividades", coluna: "aplicada", definicao: "TINYINT(1) NOT NULL DEFAULT 0" }
];

const MAX_TENTATIVAS = 5;
const NOVA_TENTATIVA_MS = 30 * 1000;

async function aplicar(pool) {
    const problemas = [];

    for (const tabela of TABELAS) {
        try {
            await pool.execute(tabela.sql);
        } catch (erro) {
            problemas.push(`${tabela.nome}: ${erro.message}`);
        }
    }

    for (const c of COLUNAS) {
        try {
            const [linhas] = await pool.execute(
                `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
                [c.tabela, c.coluna]
            );
            if (Number(linhas[0].n) === 0) {
                await pool.execute(`ALTER TABLE ${c.tabela} ADD COLUMN ${c.coluna} ${c.definicao}`);
                console.log(`[esquema] coluna ${c.tabela}.${c.coluna} criada.`);
            }
        } catch (erro) {
            problemas.push(`${c.tabela}.${c.coluna}: ${erro.message}`);
        }
    }

    return problemas;
}

// Nunca derruba o servidor: se o banco estiver fora do ar, tenta de novo algumas vezes;
// se faltar permissão, avisa qual migração rodar.
async function garantirEsquema(pool, tentativa = 1) {
    let problemas;
    try {
        problemas = await aplicar(pool);
    } catch (erro) {
        problemas = [erro.message];
    }

    if (problemas.length === 0) {
        console.log("[esquema] tabelas de questões conferidas.");
        return;
    }

    const conexaoCaida = problemas.some((p) => /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|PROTOCOL_CONNECTION_LOST|ER_ACCESS_DENIED/i.test(p));
    if (conexaoCaida && tentativa < MAX_TENTATIVAS) {
        console.warn(`[esquema] banco indisponível (tentativa ${tentativa}/${MAX_TENTATIVAS}); tentando de novo em 30s.`);
        const timer = setTimeout(() => garantirEsquema(pool, tentativa + 1), NOVA_TENTATIVA_MS);
        if (timer.unref) timer.unref();
        return;
    }

    console.warn("[esquema] não foi possível preparar o banco para as questões:");
    problemas.forEach((p) => console.warn("  - " + p));
    console.warn("[esquema] Rode JS/migrations/005-questoes-e-tempo.sql (ou schema.sql em banco novo) no MySQL.");
}

module.exports = { garantirEsquema, TABELAS, COLUNAS };
