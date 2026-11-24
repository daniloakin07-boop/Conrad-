/*
===============================================
JS/utilitarios-banco.js  (BACKEND — roda no Node.js)
===============================================
Funções pequenas de apoio ao banco, compartilhadas por atividades.js e exclusao-conta.js.

tabelasExistentes(executor, nomes)
  Descobre quais tabelas existem de fato no banco. Algumas tabelas do projeto são opcionais
  (tb_perfis_alunos é criada sob demanda pela rota /perfil; tb_questoes, tb_respostas e
  tb_inicios pertencem ao recurso de questões, ainda não integrado). Um DELETE em tabela
  inexistente abortaria a transação inteira no PostgreSQL, por isso conferimos antes.
  `executor` é o pool ou uma conexão devolvida por pool.getConnection() (JS/db.js).
*/

/**
 * @param {{execute: Function}} executor  pool ou conexão com o método execute(sql, parametros)
 * @param {string[]} nomes                nomes de tabelas do schema "public" (ex.: "tb_inicios")
 * @returns {Promise<Set<string>>}        conjunto com os nomes que existem
 */
async function tabelasExistentes(executor, nomes) {
    const existentes = new Set();
    for (const nome of nomes) {
        // to_regclass devolve NULL (e não erro) quando a tabela não existe; ::text evita o tipo regclass
        const [linhas] = await executor.execute("SELECT to_regclass(?)::text AS tabela", [`public.${nome}`]);
        if (linhas[0]?.tabela) existentes.add(nome);
    }
    return existentes;
}

module.exports = { tabelasExistentes };
