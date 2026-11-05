/*
===============================================
SESSÕES QUE SOBREVIVEM A REINÍCIOS (memória + MySQL)
===============================================
Por padrão o express-session guarda as sessões só na memória do servidor. Quando o
servidor reinicia (deploy, ou o Render "dormindo" no plano gratuito) todo mundo é
deslogado, e isso parece um bug "depois do login".

Aqui cada sessão fica na memória (rápido) E na tabela tb_sessoes do MySQL. Depois de um
reinício, a sessão é recuperada do banco no primeiro pedido.

Se o banco estiver fora do ar ou a tabela não puder ser criada, o servidor continua
funcionando só com a memória (o mesmo comportamento de antes), e avisa no terminal.
A tabela é criada automaticamente; o mesmo comando está em JS/migrations/004-sessoes-e-atividades.sql.
*/

const TABELA = "tb_sessoes";
const DURACAO_PADRAO_MS = 2 * 60 * 60 * 1000; // usada se a sessão não informar validade
const INTERVALO_RENOVACAO_MS = 60 * 1000;     // no máximo 1 escrita de "renovação" por minuto por sessão
const INTERVALO_LIMPEZA_MS = 15 * 60 * 1000;  // remove sessões vencidas a cada 15 minutos
const NOVA_TENTATIVA_MS = 30 * 1000;
const MAX_TENTATIVAS = 5;

function criarSessionStore(session, pool) {
    const memoria = new session.MemoryStore();
    const ultimaGravacao = new Map(); // sid -> instante da última escrita no banco
    let pronto = false;

    function avisar(contexto, erro) {
        console.warn(`[sessões] ${contexto}: ${erro && erro.message ? erro.message : erro}`);
    }

    // Validade da sessão em milissegundos (instante em que ela vence)
    function expiracaoDe(sess) {
        const expires = sess && sess.cookie && sess.cookie.expires;
        const instante = expires ? new Date(expires).getTime() : NaN;
        return Number.isFinite(instante) ? instante : Date.now() + DURACAO_PADRAO_MS;
    }

    async function preparar(tentativa = 1) {
        try {
            await pool.execute(
                `CREATE TABLE IF NOT EXISTS ${TABELA} (
                    sid VARCHAR(128) NOT NULL,
                    dados TEXT NOT NULL,
                    expira_em BIGINT NOT NULL,
                    PRIMARY KEY (sid),
                    INDEX idx_sessoes_expira_em (expira_em)
                )`
            );
            pronto = true;
            console.log("Sessões persistentes ativadas (tabela tb_sessoes).");
        } catch (erro) {
            if (tentativa >= MAX_TENTATIVAS) {
                avisar("não foi possível preparar a tabela; as sessões ficam só na memória", erro);
                return;
            }
            avisar(`banco indisponível (tentativa ${tentativa}/${MAX_TENTATIVAS}); usando só a memória por enquanto`, erro);
            const timer = setTimeout(() => preparar(tentativa + 1), NOVA_TENTATIVA_MS);
            if (timer.unref) timer.unref();
        }
    }

    // As três funções abaixo NUNCA rejeitam: um problema no banco não pode derrubar o login.
    async function lerDoBanco(sid) {
        if (!pronto) return null;
        try {
            const [linhas] = await pool.execute(
                `SELECT dados FROM ${TABELA} WHERE sid = ? AND expira_em > ?`,
                [sid, Date.now()]
            );
            if (linhas.length === 0) return null;
            return JSON.parse(linhas[0].dados);
        } catch (erro) {
            avisar("falha ao ler a sessão", erro);
            return null;
        }
    }

    async function gravar(sid, sess, apenasRenovar) {
        if (!pronto) return;
        const agora = Date.now();
        if (apenasRenovar && agora - (ultimaGravacao.get(sid) || 0) < INTERVALO_RENOVACAO_MS) return;
        ultimaGravacao.set(sid, agora);
        try {
            const dados = JSON.stringify(sess);
            const expira = expiracaoDe(sess);
            await pool.execute(
                `INSERT INTO ${TABELA} (sid, dados, expira_em) VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE dados = ?, expira_em = ?`,
                [sid, dados, expira, dados, expira]
            );
        } catch (erro) {
            avisar("falha ao gravar a sessão", erro);
        }
    }

    async function apagar(sid) {
        if (!pronto) return;
        try {
            await pool.execute(`DELETE FROM ${TABELA} WHERE sid = ?`, [sid]);
        } catch (erro) {
            avisar("falha ao apagar a sessão", erro);
        }
    }

    // Chama o callback do express-session; um erro dentro dele só é registrado.
    function responder(promessa, callback) {
        promessa
            .then((valor) => callback(null, valor))
            .catch((erro) => console.error("[sessões] erro inesperado:", erro));
    }

    class MySQLSessionStore extends session.Store {
        get(sid, callback) {
            memoria.get(sid, (erro, sess) => {
                if (!erro && sess) return callback(null, sess);

                // Não está na memória (ex.: servidor reiniciou): tenta o banco
                responder(
                    lerDoBanco(sid).then((doBanco) => {
                        if (!doBanco) return null;
                        return new Promise((resolver) => memoria.set(sid, doBanco, () => resolver(doBanco)));
                    }),
                    callback
                );
            });
        }

        set(sid, sess, callback) {
            memoria.set(sid, sess, (erro) => {
                if (erro) return callback && callback(erro);
                gravar(sid, sess, false).then(() => callback && callback(null));
            });
        }

        // Chamado a cada pedido (rolling): estende a validade sem esperar o banco
        touch(sid, sess, callback) {
            memoria.touch(sid, sess, (erro) => {
                gravar(sid, sess, true);
                if (callback) callback(erro || null);
            });
        }

        destroy(sid, callback) {
            ultimaGravacao.delete(sid);
            memoria.destroy(sid, () => {
                apagar(sid).then(() => callback && callback(null));
            });
        }
    }

    const limpeza = setInterval(() => {
        memoria.all(() => {}); // o MemoryStore descarta as sessões vencidas ao listar
        const limite = Date.now() - DURACAO_PADRAO_MS;
        for (const [sid, instante] of ultimaGravacao) {
            if (instante < limite) ultimaGravacao.delete(sid);
        }
        if (pronto) {
            pool.execute(`DELETE FROM ${TABELA} WHERE expira_em < ?`, [Date.now()])
                .catch((erro) => avisar("falha ao limpar sessões vencidas", erro));
        }
    }, INTERVALO_LIMPEZA_MS);
    if (limpeza.unref) limpeza.unref();

    preparar();
    return new MySQLSessionStore();
}

module.exports = criarSessionStore;
