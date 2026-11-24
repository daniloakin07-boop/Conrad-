/*
===============================================
JS/exclusao-conta.js  (BACKEND — roda no Node.js)
===============================================
Exclusão DEFINITIVA da própria conta (Web e Mobile usam a mesma rota: DELETE /conta,
registrada em JS/server.js).

Fluxo (nada é apagado antes de a senha ser conferida no servidor):
  1. exige sessão ativa; o ID da conta vem SEMPRE da sessão (req.session.usuario.id),
     nunca do corpo da requisição — não existe como pedir a exclusão da conta de outra pessoa;
  2. confere a senha atual com bcrypt.compare (mesmo hash usado pelo /login);
  3. em UMA transação do PostgreSQL: trata os registros dependentes e apaga tb_usuarios;
  4. só depois do COMMIT encerra a sessão e limpa o cookie; qualquer falha faz ROLLBACK
     e a conta permanece intacta.

POLÍTICA DE DADOS (também documentada em JS/migrations/008-exclusao-de-conta.sql)
  ALUNO excluído  -> removidos perfil, matrículas, entregas, respostas, notas e inícios de prova.
                     Turmas, atividades e contas de terceiros não são tocadas.
  EDUCADOR        -> as turmas NÃO são apagadas: ficam com professor_id = NULL ("turma sem
                     educador") e as atividades ficam com criado_por = NULL. Assim matrículas,
                     entregas, notas e boletim dos alunos continuam existindo.
  BATE-PAPO       -> anexos do usuário são apagados; as mensagens dele permanecem no histórico do
                     outro participante, porém anonimizadas ("Conta excluída", conteúdo removido).
  CONTATO         -> mensagens do "Fale conosco" enviadas com o e-mail da conta são apagadas.

Exporta:
  criarManipuladorExclusao({ pool, bcrypt, ... })  -> manipulador (req, res) da rota DELETE /conta
  excluirDadosDoUsuario(conexao, usuario)          -> lógica de banco (testável com conexão falsa)
*/

const { tabelasExistentes } = require("./utilitarios-banco.js");

// Proteção contra tentativa de adivinhar a senha por esta rota: 5 erros a cada 15 minutos
const MAX_FALHAS = 5;
const JANELA_MS = 15 * 60 * 1000;

// Texto que substitui a identificação de quem excluiu a conta nas conversas preservadas
const AUTOR_EXCLUIDO = "Conta excluída";
const MENSAGEM_REMOVIDA = "[mensagem removida]";

// Tabelas opcionais consultadas antes de apagar (ver utilitarios-banco.js)
const TABELAS_OPCIONAIS = [
    "tb_perfis_alunos", "tb_inicios", "tb_respostas", "tb_contatos",
    "tb_chat_mensagens", "tb_chat_anexos"
];

/**
 * Remove ou anonimiza TUDO que depende da conta. Deve ser chamada DENTRO de uma transação
 * (BEGIN já executado) — quem chama faz COMMIT/ROLLBACK.
 * @param {{execute: Function}} conexao  conexão reservada do pool (JS/db.js)
 * @param {{id: number, email: string, tipo: string}} usuario  dados lidos do BANCO (não do navegador)
 * @returns {Promise<object>} resumo com a quantidade de registros afetados (útil em logs e testes)
 */
async function excluirDadosDoUsuario(conexao, usuario) {
    const id = Number(usuario.id);
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error("ID de usuário inválido");

    const existentes = await tabelasExistentes(conexao, TABELAS_OPCIONAIS);
    const resumo = {};
    // Atalho: executa, guarda quantas linhas foram afetadas e devolve esse número
    const rodar = async (nome, sql, parametros) => {
        const [resultado] = await conexao.execute(sql, parametros);
        resumo[nome] = resultado.affectedRows;
        return resultado.affectedRows;
    };

    // --- EDUCADOR: preserva o histórico dos alunos --------------------------------------
    // Sem este UPDATE explícito, uma chave estrangeira antiga (ON DELETE CASCADE) apagaria as
    // turmas e as matrículas. Se a migração 008 não tiver sido aplicada, professor_id ainda é
    // NOT NULL: o UPDATE falha (23502), a transação sofre ROLLBACK e NADA é excluído.
    if (usuario.tipo === "educador") {
        await rodar("turmas_sem_educador", "UPDATE tb_turmas SET professor_id = NULL WHERE professor_id = ?", [id]);
        await rodar("atividades_sem_autor", "UPDATE tb_atividades SET criado_por = NULL WHERE criado_por = ?", [id]);
    }

    // --- Bate-papo: anonimiza mensagens e apaga anexos escritos pelo usuário ---------------
    if (existentes.has("tb_chat_mensagens")) {
        await rodar(
            "mensagens_anonimizadas",
            `UPDATE tb_chat_mensagens
                SET autor_id = 0, autor_nome = ?, tipo = 'texto', conteudo = ?,
                    anexo_id = NULL, mime_type = NULL, nome_arquivo = NULL
              WHERE autor_id = ?`,
            [AUTOR_EXCLUIDO, MENSAGEM_REMOVIDA, id]
        );
    }
    if (existentes.has("tb_chat_anexos")) {
        await rodar("anexos_apagados", "DELETE FROM tb_chat_anexos WHERE autor_id = ?", [id]);
    }

    // --- Dados do estudante (apagados explicitamente; não dependemos só do CASCADE) -------
    if (existentes.has("tb_respostas")) {
        await rodar(
            "respostas",
            "DELETE FROM tb_respostas WHERE entrega_id IN (SELECT id FROM tb_entregas WHERE aluno_id = ?)",
            [id]
        );
    }
    if (existentes.has("tb_inicios")) {
        await rodar("inicios", "DELETE FROM tb_inicios WHERE aluno_id = ?", [id]);
    }
    await rodar("notas", "DELETE FROM tb_notas WHERE aluno_id = ?", [id]);
    await rodar("entregas", "DELETE FROM tb_entregas WHERE aluno_id = ?", [id]);
    await rodar("matriculas", "DELETE FROM tb_turma_alunos WHERE aluno_id = ?", [id]);
    if (existentes.has("tb_perfis_alunos")) {
        await rodar("perfil", "DELETE FROM tb_perfis_alunos WHERE usuario_id = ?", [id]);
    }

    // --- Mensagens do "Fale conosco" enviadas com o e-mail desta conta ---------------------
    if (existentes.has("tb_contatos") && usuario.email) {
        await rodar("contatos", "DELETE FROM tb_contatos WHERE LOWER(email) = LOWER(?)", [usuario.email]);
    }

    // --- Por fim, a própria conta (somente a linha deste ID) -------------------------------
    const apagadas = await rodar("usuario", "DELETE FROM tb_usuarios WHERE id = ?", [id]);
    if (apagadas !== 1) throw new Error("A conta não pôde ser removida");

    return resumo;
}

/**
 * Destrói, no armazenamento de sessões, as OUTRAS sessões abertas com esta conta (ex.: o mesmo
 * usuário logado no navegador e no celular). Só funciona em stores que oferecem all()/destroy(),
 * como o MemoryStore padrão do express-session; nos demais, a verificação feita em GET /me
 * (JS/server.js) derruba a sessão na próxima consulta.
 */
function invalidarSessoesDoUsuario(store, usuarioId) {
    return new Promise((resolve) => {
        if (!store || typeof store.all !== "function" || typeof store.destroy !== "function") return resolve(0);
        store.all((erro, sessoes) => {
            if (erro || !sessoes || typeof sessoes !== "object") return resolve(0);
            const ids = Object.keys(sessoes).filter((sid) => Number(sessoes[sid]?.usuario?.id) === Number(usuarioId));
            ids.forEach((sid) => store.destroy(sid, () => {}));
            resolve(ids.length);
        });
    });
}

/**
 * Cria o manipulador da rota DELETE /conta.
 * @param {object} opcoes
 * @param {object} opcoes.pool          pool de JS/db.js
 * @param {object} opcoes.bcrypt        biblioteca de hash (a mesma do /login: bcryptjs)
 * @param {string} [opcoes.nomeCookie]  nome do cookie de sessão
 * @param {object} [opcoes.opcoesCookie] atributos do cookie (precisam coincidir para o navegador removê-lo)
 * @param {Function} [opcoes.agora]     relógio (injetável em testes)
 */
function criarManipuladorExclusao({ pool, bcrypt, nomeCookie = "conrad.sid", opcoesCookie = {}, agora = Date.now }) {
    // usuarioId -> { falhas, desde }  (memória do processo; suficiente para frear tentativas em série)
    const falhasPorUsuario = new Map();
    // Contas com exclusão em andamento: impede duas execuções simultâneas (clique duplo)
    const emAndamento = new Set();

    const bloqueado = (id) => {
        const registro = falhasPorUsuario.get(id);
        if (!registro) return false;
        if (agora() - registro.desde > JANELA_MS) {
            falhasPorUsuario.delete(id);
            return false;
        }
        return registro.falhas >= MAX_FALHAS;
    };
    const registrarFalha = (id) => {
        const registro = falhasPorUsuario.get(id);
        if (!registro || agora() - registro.desde > JANELA_MS) {
            falhasPorUsuario.set(id, { falhas: 1, desde: agora() });
        } else {
            registro.falhas += 1;
        }
    };

    return async function excluirConta(req, res) {
        // 1) Autenticação: o ID da conta vem da sessão, nunca do corpo ou da URL
        const sessao = req.session?.usuario;
        if (!sessao) return res.status(401).json({ erro: "Faça login para continuar" });
        const usuarioId = Number(sessao.id);

        // 2) Validação da senha enviada (tipo e tamanho; bcrypt só considera os 72 primeiros bytes)
        const senha = req.body?.senha;
        if (typeof senha !== "string" || senha.length === 0) {
            return res.status(400).json({ erro: "Informe sua senha para confirmar a exclusão" });
        }
        if (senha.length > 200) return res.status(400).json({ erro: "Senha inválida" });

        if (bloqueado(usuarioId)) {
            return res.status(429).json({ erro: "Muitas tentativas incorretas. Aguarde alguns minutos e tente novamente." });
        }
        if (emAndamento.has(usuarioId)) {
            return res.status(409).json({ erro: "A exclusão da conta já está em andamento" });
        }
        emAndamento.add(usuarioId);

        let conexao;
        try {
            // 3) Dados reais da conta, lidos do banco (o tipo da sessão não é usado para decidir)
            const [usuarios] = await pool.execute(
                "SELECT id, email, tipo, senha FROM tb_usuarios WHERE id = ? LIMIT 1",
                [usuarioId]
            );
            if (!usuarios.length) {
                // Conta já inexistente (ex.: excluída em outro dispositivo): encerra esta sessão também
                await new Promise((resolve) => req.session.destroy(() => resolve()));
                res.clearCookie(nomeCookie, opcoesCookie);
                return res.status(401).json({ erro: "Esta conta não existe mais" });
            }
            const conta = usuarios[0];

            // 4) Reconfirma a identidade com a senha atual. Usa 403 (e não 401) porque o app Mobile
            //    trata 401 como "sessão expirada" e deslogaria o usuário por um simples erro de digitação.
            const senhaCorreta = await bcrypt.compare(senha, conta.senha);
            if (!senhaCorreta) {
                registrarFalha(usuarioId);
                return res.status(403).json({ erro: "Senha incorreta" });
            }

            // 5) Exclusão atômica: ou tudo é tratado e a conta some, ou nada muda
            conexao = await pool.getConnection();
            await conexao.beginTransaction();
            try {
                await excluirDadosDoUsuario(conexao, conta);
                await conexao.commit();
            } catch (erroTransacao) {
                await conexao.rollback().catch(() => {});
                throw erroTransacao;
            }

            // 6) Somente após o COMMIT: encerra sessões e invalida o cookie
            falhasPorUsuario.delete(usuarioId);
            await invalidarSessoesDoUsuario(req.sessionStore, usuarioId);
            await new Promise((resolve) => req.session.destroy(() => resolve()));
            res.clearCookie(nomeCookie, opcoesCookie);
            return res.json({ mensagem: "Sua conta foi excluída permanentemente." });
        } catch (erro) {
            console.error("Erro ao excluir conta:", erro);
            // 23502 = NOT NULL violado: a migração 008 ainda não foi executada no banco
            if (erro.code === "23502") {
                return res.status(503).json({
                    erro: "A exclusão de contas de educadores ainda não está habilitada neste servidor. Contate o suporte."
                });
            }
            return res.status(500).json({ erro: "Não foi possível excluir a conta. Nada foi alterado." });
        } finally {
            emAndamento.delete(usuarioId);
            if (conexao) conexao.release();
        }
    };
}

module.exports = { criarManipuladorExclusao, excluirDadosDoUsuario, invalidarSessoesDoUsuario, AUTOR_EXCLUIDO };
