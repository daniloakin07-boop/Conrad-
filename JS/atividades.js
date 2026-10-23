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
*/

const express = require("express");
const pool = require("./db.js");

const router = express.Router();

// O cadastro pode gravar "aluno" ou "estudante"; aceitamos os dois.
const ehEducador = (u) => u?.tipo === "educador";
const ehAluno = (u) => u?.tipo === "aluno" || u?.tipo === "estudante";

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
const COLUNAS_ATIVIDADE = `a.id, a.titulo, a.turma, a.disciplina,
    DATE_FORMAT(a.data_aplicacao, '%Y-%m-%d') AS data_aplicacao,
    a.valor_maximo, a.descricao, a.tipo`;

/*
===============================================
PROFESSOR
===============================================
*/

// Criar atividade ou avaliação
router.post("/atividades", soEducador, async (req, res) => {
    try {
        const { titulo, turma, disciplina, data_aplicacao, valor_maximo, descricao, tipo } = req.body;

        if (!titulo || !turma || !disciplina) {
            return res.status(400).json({ erro: "Preencha título, turma e disciplina" });
        }

        const valor = Number(valor_maximo ?? 10);
        if (!Number.isFinite(valor) || valor <= 0 || valor > 1000) {
            return res.status(400).json({ erro: "Valor máximo inválido" });
        }

        const tipoFinal = tipo === "avaliacao" ? "avaliacao" : "atividade";

        const [resultado] = await pool.execute(
            `INSERT INTO tb_atividades
                (titulo, turma, disciplina, data_aplicacao, valor_maximo, descricao, tipo, criado_por)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                String(titulo).trim(),
                turma,
                disciplina,
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
        const [linhas] = await pool.execute(
            `SELECT ${COLUNAS_ATIVIDADE},
                (SELECT COUNT(*) FROM tb_entregas e WHERE e.atividade_id = a.id) AS total_entregas,
                (SELECT COUNT(*) FROM tb_entregas e
                    WHERE e.atividade_id = a.id AND e.corrigida_em IS NOT NULL) AS corrigidas
             FROM tb_atividades a
             WHERE a.criado_por = ?
             ORDER BY a.criada_em DESC`,
            [req.session.usuario.id]
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
        if (req.body.nota === "" || !Number.isFinite(nota) || nota < 0 || nota > Number(valor_maximo)) {
            return res.status(400).json({ erro: `A nota deve ficar entre 0 e ${Number(valor_maximo)}` });
        }

        const feedback = req.body.feedback ? String(req.body.feedback).trim() : null;

        conexao = await pool.getConnection();
        await conexao.beginTransaction();

        await conexao.execute(
            `INSERT INTO tb_notas (atividade_id, aluno_id, nota) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE nota = ?`,
            [atividade_id, aluno_id, nota, nota]
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

// Listar atividades/provas da turma do aluno, com a entrega, nota e feedback dele
// (se o aluno ainda não escolheu a turma, mostra todas)
router.get("/aluno/atividades", soAluno, async (req, res) => {
    try {
        const alunoId = req.session.usuario.id;

        const [usuarios] = await pool.execute("SELECT turma FROM tb_usuarios WHERE id = ?", [alunoId]);
        const turma = usuarios[0]?.turma || null;

        const parametros = [alunoId, alunoId];
        let filtro = "";
        if (turma) {
            filtro = "WHERE a.turma = ?";
            parametros.push(turma);
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

        res.json({ turma, atividades });
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

        const [atividades] = await pool.execute("SELECT id FROM tb_atividades WHERE id = ?", [id]);
        if (atividades.length === 0) return res.status(404).json({ erro: "Atividade não encontrada" });

        const alunoId = req.session.usuario.id;

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
             ON DUPLICATE KEY UPDATE resposta = ?, enviada_em = CURRENT_TIMESTAMP`,
            [id, alunoId, resposta, resposta]
        );

        res.status(201).json({ mensagem: "Resposta enviada" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: "Erro ao enviar resposta" });
    }
});

module.exports = router;