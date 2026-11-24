/*
===============================================
ROTAS DE ATIVIDADES, PROVAS, ENTREGAS E NOTAS
===============================================
Fluxo:
  1. Professor cria atividade/avaliação  -> POST /api/atividades
  2. Aluno vê a lista da turma           -> GET  /api/aluno/atividades
  3. Aluno envia a resposta              -> POST /api/atividades/:id/entrega
  4. Professor vê as entregas            -> GET  /api/atividades/:id/entregas
  5. Professor dá nota e feedback        -> PUT  /api/entregas/:id/correcao
  6. Aluno vê nota e feedback            -> GET  /api/aluno/atividades
  7. Professor edita a atividade         -> PUT    /api/atividades/:id      (somente o autor)
  8. Professor exclui a atividade        -> DELETE /api/atividades/:id      (somente o autor)
*/

const express = require("express");
const pool = require("./db.js");
const { tabelasExistentes } = require("./utilitarios-banco.js");

const router = express.Router();

// O cadastro pode gravar "aluno" ou "estudante"; aceitamos os dois.
const ehEducador = (u) => u?.tipo === "educador";
const ehAluno = (u) => u?.tipo === "aluno" || u?.tipo === "estudante" || !u?.tipo;

// Middleware: exige login e um tipo de usuário específico
function exigir(verificador, mensagem) {
    return (req, res, next) => {
        const usuario = req.session.usuario;
        if (!usuario) return res.status(401).json({ erro: "Faça login para continuar" });
        if (!verificador(usuario)) return res.status(403).json({ erro: mensagem });
        next();
    };
}

const soEducador = exigir(ehEducador, "Apenas educadores podem fazer isso");
const soAluno = exigir(ehAluno, "Apenas alunos podem fazer isso");

// Colunas de atividade devolvidas ao front (data já formatada como YYYY-MM-DD)
const COLUNAS_ATIVIDADE = `a.id, a.titulo, a.turma, a.turma_id, a.disciplina,
    TO_CHAR(a.data_aplicacao, 'YYYY-MM-DD') AS data_aplicacao,
    a.valor_maximo, a.descricao, a.tipo`;

/*
===============================================
PROFESSOR
===============================================
*/

// Criar atividade ou avaliação
router.post("/atividades", soEducador, async (req, res) => {
    try {
        const { titulo, turma_id, data_aplicacao, valor_maximo, descricao, tipo } = req.body;

        if (!titulo || !String(titulo).trim()) {
            return res.status(400).json({ erro: "Preencha o título" });
        }
        if (turma_id === undefined || turma_id === null || turma_id === "") {
            return res.status(400).json({ erro: "Selecione a turma em que o conteúdo será publicado" });
        }

        const valor = Number(valor_maximo ?? 10);
        if (!Number.isFinite(valor) || valor <= 0 || valor > 1000) {
            return res.status(400).json({ erro: "Valor máximo inválido" });
        }

        const turmaIdFinal = Number(turma_id);
        if (!Number.isInteger(turmaIdFinal) || turmaIdFinal <= 0) {
            return res.status(400).json({ erro: "Selecione uma turma válida" });
        }
        // O professor só publica em turmas que ele mesmo criou; nome e disciplina vêm do banco, não do navegador.
        const [turmas] = await pool.execute(
            "SELECT id, nome, disciplina FROM tb_turmas WHERE id = ? AND professor_id = ?",
            [turmaIdFinal, req.session.usuario.id]
        );
        if (!turmas.length) return res.status(403).json({ erro: "Você não pode publicar nesta turma" });
        const turmaFinal = turmas[0].nome;
        const disciplinaFinal = turmas[0].disciplina;

        const tipoFinal = tipo === "avaliacao" ? "avaliacao" : "atividade";

        // avaliativa/aplicada = 1: a nota lançada entra no boletim e nas médias (medias.js só lê esses registros).
        const [resultado] = await pool.execute(
            `INSERT INTO tb_atividades
                (titulo, turma, turma_id, disciplina, data_aplicacao, valor_maximo, descricao, tipo, avaliativa, aplicada, criado_por)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE, TRUE, ?)`,
            [
                String(titulo).trim(),
                turmaFinal,
                turmaIdFinal,
                disciplinaFinal,
                data_aplicacao || null,
                valor,
                descricao ? String(descricao).trim() : null,
                tipoFinal,
                req.session.usuario.id
            ]
        );

        res.status(201).json({ id: resultado.insertId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: "Erro ao criar atividade" });
    }
});

// Listar as atividades do professor logado, com contagem de entregas
router.get("/atividades", soEducador, async (req, res) => {
    try {
        const parametros = [req.session.usuario.id];
        let filtro = "a.criado_por = ?";

        if (req.query.turmaId) {
            const turmaId = Number(req.query.turmaId);
            if (!Number.isInteger(turmaId) || turmaId <= 0) {
                return res.status(400).json({ erro: "Turma inválida" });
            }
            const [turmas] = await pool.execute(
                "SELECT id FROM tb_turmas WHERE id = ? AND professor_id = ?",
                [turmaId, req.session.usuario.id]
            );
            if (!turmas.length) return res.status(403).json({ erro: "Você não tem acesso a esta turma" });
            filtro += " AND a.turma_id = ?";
            parametros.push(turmaId);
        }

        if (["atividade", "avaliacao"].includes(req.query.tipo)) {
            filtro += " AND a.tipo = ?";
            parametros.push(req.query.tipo);
        }

        const [linhas] = await pool.execute(
            `SELECT ${COLUNAS_ATIVIDADE},
                (SELECT COUNT(*) FROM tb_entregas e WHERE e.atividade_id = a.id) AS total_entregas,
                (SELECT COUNT(*) FROM tb_entregas e
                    WHERE e.atividade_id = a.id AND e.corrigida_em IS NOT NULL) AS corrigidas
             FROM tb_atividades a
             WHERE ${filtro}
             ORDER BY a.criada_em DESC`,
            parametros
        );
        res.json(linhas);
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: "Erro ao listar atividades" });
    }
});

// Listar as entregas de uma atividade (somente do professor que a criou)
router.get("/atividades/:id/entregas", soEducador, async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id)) return res.status(400).json({ erro: "Atividade inválida" });

        const [dona] = await pool.execute(
            "SELECT valor_maximo FROM tb_atividades WHERE id = ? AND criado_por = ?",
            [id, req.session.usuario.id]
        );
        if (dona.length === 0) return res.status(404).json({ erro: "Atividade não encontrada" });

        const [entregas] = await pool.execute(
            `SELECT e.id, u.nome AS aluno, e.resposta, e.enviada_em,
                    e.feedback, e.corrigida_em, n.nota
             FROM tb_entregas e
             JOIN tb_usuarios u ON u.id = e.aluno_id
             LEFT JOIN tb_notas n ON n.atividade_id = e.atividade_id AND n.aluno_id = e.aluno_id
             WHERE e.atividade_id = ?
             ORDER BY e.enviada_em`,
            [id]
        );

        res.json({ valor_maximo: dona[0].valor_maximo, entregas });
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: "Erro ao listar entregas" });
    }
});

// Corrigir uma entrega: grava a nota em tb_notas e o feedback em tb_entregas
router.put("/entregas/:id/correcao", soEducador, async (req, res) => {
    let conexao;
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id)) return res.status(400).json({ erro: "Entrega inválida" });

        const [entregas] = await pool.execute(
            `SELECT e.atividade_id, e.aluno_id, a.valor_maximo
             FROM tb_entregas e
             JOIN tb_atividades a ON a.id = e.atividade_id
             WHERE e.id = ? AND a.criado_por = ?`,
            [id, req.session.usuario.id]
        );
        if (entregas.length === 0) return res.status(404).json({ erro: "Entrega não encontrada" });

        const { atividade_id, aluno_id, valor_maximo } = entregas[0];

        const nota = Number(req.body.nota);
        if (req.body.nota === "" || req.body.nota === null || req.body.nota === undefined
            || !Number.isFinite(nota) || nota < 0 || nota > Number(valor_maximo)) {
            return res.status(400).json({ erro: `A nota deve ficar entre 0 e ${Number(valor_maximo)}` });
        }

        const feedback = req.body.feedback ? String(req.body.feedback).trim() : null;

        conexao = await pool.getConnection();
        await conexao.beginTransaction();

        await conexao.execute(
            `INSERT INTO tb_notas (atividade_id, aluno_id, nota) VALUES (?, ?, ?)
             ON CONFLICT (atividade_id, aluno_id)
             DO UPDATE SET nota = EXCLUDED.nota, atualizada_em = NOW()`,
            [atividade_id, aluno_id, nota]
        );
        await conexao.execute(
            "UPDATE tb_entregas SET feedback = ?, corrigida_em = NOW() WHERE id = ?",
            [feedback, id]
        );

        await conexao.commit();
        res.json({ mensagem: "Correção salva" });
    } catch (error) {
        if (conexao) await conexao.rollback();
        console.error(error);
        res.status(500).json({ erro: "Erro ao salvar correção" });
    } finally {
        if (conexao) conexao.release();
    }
});

/*
===============================================
EDIÇÃO E EXCLUSÃO DE ATIVIDADES (somente o educador autor)
===============================================
A propriedade é sempre conferida NO SERVIDOR pelo par (id da atividade, criado_por = educador da
sessão). Para quem não é o autor a resposta é 404 (não revela que a atividade existe).
Web (professor-correcao.js) e Mobile (api.editarAtividade / api.excluirAtividade) usam as mesmas rotas.
*/

// Erro com código HTTP: lançado dentro das transações para provocar ROLLBACK e responder ao cliente
function erroHttp(status, mensagem) {
    const erro = new Error(mensagem);
    erro.status = status;
    return erro;
}

// 'AAAA-MM-DD' que realmente existe no calendário (rejeita 2026-02-31)
function dataIsoValida(texto) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
    if (!m) return false;
    const [, a, mes, d] = m.map(Number);
    const data = new Date(Date.UTC(a, mes - 1, d));
    return data.getUTCFullYear() === a && data.getUTCMonth() === mes - 1 && data.getUTCDate() === d;
}

// Atualizar atividade ou avaliação já publicada
router.put("/atividades/:id", soEducador, async (req, res) => {
    let conexao;
    try {
        const id = Number(req.params.id);
        if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ erro: "Atividade inválida" });
        const educadorId = req.session.usuario.id;
        const corpo = req.body || {};

        conexao = await pool.getConnection();
        await conexao.beginTransaction();

        // FOR UPDATE trava a linha: uma correção feita ao mesmo tempo não consegue invalidar a checagem do valor máximo
        const [atuais] = await conexao.execute(
            `SELECT id, titulo, turma, turma_id, disciplina,
                    TO_CHAR(data_aplicacao, 'YYYY-MM-DD') AS data_aplicacao,
                    valor_maximo, descricao, tipo
             FROM tb_atividades WHERE id = ? AND criado_por = ? FOR UPDATE`,
            [id, educadorId]
        );
        if (!atuais.length) throw erroHttp(404, "Atividade não encontrada");
        const atual = atuais[0];

        // ---- validação dos campos (o que não vier no corpo permanece como está) ----
        const titulo = corpo.titulo === undefined ? atual.titulo : String(corpo.titulo ?? "").trim();
        if (!titulo) throw erroHttp(400, "Preencha o título");
        if (titulo.length > 160) throw erroHttp(400, "O título deve ter no máximo 160 caracteres");

        let descricao = atual.descricao;
        if (corpo.descricao !== undefined) {
            descricao = corpo.descricao === null ? null : String(corpo.descricao).trim() || null;
            if (descricao && descricao.length > 5000) throw erroHttp(400, "A descrição deve ter no máximo 5000 caracteres");
        }

        let dataAplicacao = atual.data_aplicacao;
        if (corpo.data_aplicacao !== undefined) {
            dataAplicacao = corpo.data_aplicacao === null || corpo.data_aplicacao === "" ? null : String(corpo.data_aplicacao);
            if (dataAplicacao && !dataIsoValida(dataAplicacao)) throw erroHttp(400, "Data de entrega inválida");
        }

        let valor = Number(atual.valor_maximo);
        if (corpo.valor_maximo !== undefined) {
            valor = Number(corpo.valor_maximo);
            if (corpo.valor_maximo === null || corpo.valor_maximo === "" || !Number.isFinite(valor) || valor <= 0 || valor > 1000) {
                throw erroHttp(400, "Valor máximo inválido");
            }
            valor = Math.round(valor * 100) / 100; // a coluna é NUMERIC(7,2)
        }

        let tipo = atual.tipo;
        if (corpo.tipo !== undefined) {
            if (!["atividade", "avaliacao"].includes(corpo.tipo)) throw erroHttp(400, "Tipo inválido");
            tipo = corpo.tipo;
        }

        let turmaId = atual.turma_id;
        if (corpo.turma_id !== undefined) {
            turmaId = Number(corpo.turma_id);
            if (!Number.isSafeInteger(turmaId) || turmaId <= 0) throw erroHttp(400, "Selecione uma turma válida");
        }

        // ---- consistência com entregas e notas já existentes ----
        const [linhasEntregas] = await conexao.execute(
            "SELECT COUNT(*) AS total FROM tb_entregas WHERE atividade_id = ?", [id]);
        const [linhasNotas] = await conexao.execute(
            "SELECT COUNT(*) AS total, MAX(nota) AS maior FROM tb_notas WHERE atividade_id = ?", [id]);
        const totalEntregas = Number(linhasEntregas[0].total);
        const totalNotas = Number(linhasNotas[0].total);
        const maior = linhasNotas[0].maior;

        // Nunca deixa o valor máximo abaixo de uma nota já lançada
        if (totalNotas > 0 && valor < Number(maior)) {
            throw erroHttp(409, `O valor máximo não pode ser menor que a maior nota já lançada (${Number(maior)})`);
        }

        // Troca de turma ou de tipo só é permitida enquanto não há entregas nem notas
        let turmaNome = atual.turma;
        let disciplina = atual.disciplina;
        const mudouTurma = turmaId !== (atual.turma_id === null ? null : Number(atual.turma_id));
        if (mudouTurma) {
            if (totalEntregas > 0 || totalNotas > 0) {
                throw erroHttp(409, "Não é possível trocar a turma de uma atividade que já tem entregas ou notas");
            }
            // O educador só publica em turmas que ele mesmo criou; nome e disciplina vêm do banco
            const [turmas] = await conexao.execute(
                "SELECT id, nome, disciplina FROM tb_turmas WHERE id = ? AND professor_id = ?",
                [turmaId, educadorId]
            );
            if (!turmas.length) throw erroHttp(403, "Você não pode publicar nesta turma");
            turmaNome = turmas[0].nome;
            disciplina = turmas[0].disciplina;
        }
        if (tipo !== atual.tipo && totalEntregas > 0) {
            throw erroHttp(409, "Não é possível alterar o tipo de uma atividade que já tem entregas");
        }

        // ---- grava: só os campos editáveis (criado_por, criada_em, avaliativa e aplicada permanecem) ----
        await conexao.execute(
            `UPDATE tb_atividades
                SET titulo = ?, turma = ?, turma_id = ?, disciplina = ?, data_aplicacao = ?,
                    valor_maximo = ?, descricao = ?, tipo = ?
              WHERE id = ? AND criado_por = ?`,
            [titulo, turmaNome, turmaId, disciplina, dataAplicacao, valor, descricao, tipo, id, educadorId]
        );

        // Devolve a atividade já no formato da listagem, para o cliente atualizar a tela sem nova consulta
        const [atualizadas] = await conexao.execute(
            `SELECT ${COLUNAS_ATIVIDADE},
                (SELECT COUNT(*) FROM tb_entregas e WHERE e.atividade_id = a.id) AS total_entregas,
                (SELECT COUNT(*) FROM tb_entregas e
                    WHERE e.atividade_id = a.id AND e.corrigida_em IS NOT NULL) AS corrigidas
             FROM tb_atividades a WHERE a.id = ?`,
            [id]
        );
        await conexao.commit();
        res.json({ mensagem: "Atividade atualizada", atividade: atualizadas[0] });
    } catch (error) {
        if (conexao) await conexao.rollback().catch(() => {});
        if (error.status) return res.status(error.status).json({ erro: error.message });
        console.error(error);
        res.status(500).json({ erro: "Erro ao atualizar atividade" });
    } finally {
        if (conexao) conexao.release();
    }
});

// Excluir atividade/avaliação. Remove também as entregas, respostas e notas DESTA atividade (e só dela).
router.delete("/atividades/:id", soEducador, async (req, res) => {
    let conexao;
    try {
        const id = Number(req.params.id);
        if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ erro: "Atividade inválida" });
        const educadorId = req.session.usuario.id;

        conexao = await pool.getConnection();
        await conexao.beginTransaction();

        // Confere a autoria e trava a linha (evita corrigir/entregar no meio da exclusão)
        const [donas] = await conexao.execute(
            "SELECT id FROM tb_atividades WHERE id = ? AND criado_por = ? FOR UPDATE",
            [id, educadorId]
        );
        if (!donas.length) throw erroHttp(404, "Atividade não encontrada");

        // Tabelas do recurso de questões são opcionais; as demais são removidas explicitamente
        // (não dependemos apenas do ON DELETE CASCADE, que pode não existir em bancos antigos).
        const existentes = await tabelasExistentes(conexao, ["tb_respostas", "tb_questoes", "tb_inicios"]);
        if (existentes.has("tb_respostas")) {
            await conexao.execute(
                "DELETE FROM tb_respostas WHERE entrega_id IN (SELECT id FROM tb_entregas WHERE atividade_id = ?)",
                [id]
            );
        }
        if (existentes.has("tb_questoes")) await conexao.execute("DELETE FROM tb_questoes WHERE atividade_id = ?", [id]);
        if (existentes.has("tb_inicios")) await conexao.execute("DELETE FROM tb_inicios WHERE atividade_id = ?", [id]);

        const [notas] = await conexao.execute("DELETE FROM tb_notas WHERE atividade_id = ?", [id]);
        const [entregas] = await conexao.execute("DELETE FROM tb_entregas WHERE atividade_id = ?", [id]);
        await conexao.execute("DELETE FROM tb_atividades WHERE id = ? AND criado_por = ?", [id, educadorId]);

        await conexao.commit();
        res.json({
            mensagem: "Atividade excluída",
            id,
            removidas: { entregas: entregas.affectedRows, notas: notas.affectedRows }
        });
    } catch (error) {
        if (conexao) await conexao.rollback().catch(() => {});
        if (error.status) return res.status(error.status).json({ erro: error.message });
        console.error(error);
        res.status(500).json({ erro: "Erro ao excluir atividade" });
    } finally {
        if (conexao) conexao.release();
    }
});

/*
===============================================
ALUNO
===============================================
*/

// Salvar a turma do aluno
router.put("/aluno/turma", soAluno, async (req, res) => {
    try {
        const turma = String(req.body.turma ?? "").trim();
        if (!turma || turma.length > 80) return res.status(400).json({ erro: "Turma inválida" });

        await pool.execute("UPDATE tb_usuarios SET turma = ? WHERE id = ?", [turma, req.session.usuario.id]);
        res.json({ mensagem: "Turma salva" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: "Erro ao salvar turma" });
    }
});

// Listar somente atividades das turmas em que o aluno está matriculado, com entrega, nota e feedback.
router.get("/aluno/atividades", soAluno, async (req, res) => {
    try {
        const alunoId = req.session.usuario.id;
        const parametros = [alunoId, alunoId];
        let filtro = "";
        let turmaNome = null;

        if (req.query.turmaId) {
            const turmaId = Number(req.query.turmaId);
            if (!Number.isInteger(turmaId) || turmaId <= 0) {
                return res.status(400).json({ erro: "Turma inválida" });
            }
            const [matriculas] = await pool.execute(
                `SELECT t.id, t.nome FROM tb_turma_alunos ta
                 JOIN tb_turmas t ON t.id = ta.turma_id
                 WHERE ta.turma_id = ? AND ta.aluno_id = ?`,
                [turmaId, alunoId]
            );
            if (!matriculas.length) return res.status(403).json({ erro: "Você não está matriculado nesta turma" });
            turmaNome = matriculas[0].nome;
            filtro = "WHERE a.turma_id = ?";
            parametros.push(turmaId);
        } else {
            const [usuarios] = await pool.execute("SELECT turma FROM tb_usuarios WHERE id = ?", [alunoId]);
            const turmaAntiga = usuarios[0]?.turma || null;
            filtro = `WHERE (
                a.turma_id IN (SELECT ta.turma_id FROM tb_turma_alunos ta WHERE ta.aluno_id = ?)
                OR (a.turma_id IS NULL AND a.turma = ?)
            )`;
            parametros.push(alunoId, turmaAntiga);
            turmaNome = turmaAntiga;
        }

        if (["atividade", "avaliacao"].includes(req.query.tipo)) {
            filtro += " AND a.tipo = ?";
            parametros.push(req.query.tipo);
        }

        const [atividades] = await pool.execute(
            `SELECT ${COLUNAS_ATIVIDADE},
                    e.resposta, e.enviada_em, e.feedback, e.corrigida_em, n.nota
             FROM tb_atividades a
             LEFT JOIN tb_entregas e ON e.atividade_id = a.id AND e.aluno_id = ?
             LEFT JOIN tb_notas n ON n.atividade_id = a.id AND n.aluno_id = ?
             ${filtro}
             ORDER BY a.criada_em DESC`,
            parametros
        );

        res.json({ turma: turmaNome, turma_id: req.query.turmaId ? Number(req.query.turmaId) : null, atividades });
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: "Erro ao listar atividades" });
    }
});

// Enviar (ou atualizar) a resposta de uma atividade
router.post("/atividades/:id/entrega", soAluno, async (req, res) => {
    try {
        const id = Number(req.params.id);
        const resposta = String(req.body.resposta ?? "").trim();

        if (!Number.isInteger(id)) return res.status(400).json({ erro: "Atividade inválida" });
        if (!resposta || resposta.length > 5000) {
            return res.status(400).json({ erro: "A resposta deve ter entre 1 e 5000 caracteres" });
        }

        const [atividades] = await pool.execute("SELECT id, turma, turma_id FROM tb_atividades WHERE id = ?", [id]);
        if (atividades.length === 0) return res.status(404).json({ erro: "Atividade não encontrada" });

        const alunoId = req.session.usuario.id;
        if (atividades[0].turma_id) {
            const [matriculas] = await pool.execute(
                "SELECT id FROM tb_turma_alunos WHERE turma_id = ? AND aluno_id = ?",
                [atividades[0].turma_id, alunoId]
            );
            if (!matriculas.length) return res.status(403).json({ erro: "Você não está matriculado na turma desta atividade" });

            // Turma cujo educador excluiu a conta (professor_id = NULL): ninguém poderá corrigir, então não recebe entregas
            const [donos] = await pool.execute("SELECT professor_id FROM tb_turmas WHERE id = ?", [atividades[0].turma_id]);
            if (!donos.length || donos[0].professor_id === null) {
                return res.status(409).json({ erro: "Esta turma está sem educador responsável e não recebe novas entregas" });
            }
        } else {
            // Atividade antiga, de antes das turmas com código: vale só para a turma que o aluno tinha salva.
            const [usuarios] = await pool.execute("SELECT turma FROM tb_usuarios WHERE id = ?", [alunoId]);
            if (!usuarios[0]?.turma || usuarios[0].turma !== atividades[0].turma) {
                return res.status(403).json({ erro: "Você não está matriculado na turma desta atividade" });
            }
        }

        // Depois de corrigida, a entrega não pode mais ser alterada
        const [existentes] = await pool.execute(
            "SELECT corrigida_em FROM tb_entregas WHERE atividade_id = ? AND aluno_id = ?",
            [id, alunoId]
        );
        if (existentes[0]?.corrigida_em) {
            return res.status(409).json({ erro: "Esta entrega já foi corrigida e não pode ser alterada" });
        }

        await pool.execute(
            `INSERT INTO tb_entregas (atividade_id, aluno_id, resposta) VALUES (?, ?, ?)
             ON CONFLICT (atividade_id, aluno_id)
             DO UPDATE SET resposta = EXCLUDED.resposta, enviada_em = CURRENT_TIMESTAMP`,
            [id, alunoId, resposta]
        );

        res.status(201).json({ mensagem: "Resposta enviada" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: "Erro ao enviar resposta" });
    }
});

module.exports = router;