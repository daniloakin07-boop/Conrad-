const express = require("express");
const crypto = require("crypto");
const pool = require("./db.js");

const router = express.Router();

const ehEducador = (usuario) => usuario?.tipo === "educador";
const ehAluno = (usuario) => usuario?.tipo === "aluno" || usuario?.tipo === "estudante" || !usuario?.tipo;

function exigir(verificador, mensagem) {
    return (req, res, next) => {
        const usuario = req.session?.usuario;
        if (!usuario) return res.status(401).json({ erro: "Faça login para continuar" });
        if (!verificador(usuario)) return res.status(403).json({ erro: mensagem });
        next();
    };
}

const soEducador = exigir(ehEducador, "Apenas educadores podem criar e gerenciar turmas");
const soAluno = exigir(ehAluno, "Apenas alunos podem entrar em uma turma com código");
const logado = exigir(() => true, "Acesso não permitido");

async function usuarioPodeAcessarTurma(turmaId, usuario) {
    if (ehEducador(usuario)) {
        const [linhas] = await pool.execute(
            "SELECT id FROM tb_turmas WHERE id = ? AND professor_id = ?",
            [turmaId, usuario.id]
        );
        return linhas.length > 0;
    }

    const [linhas] = await pool.execute(
        "SELECT id FROM tb_turma_alunos WHERE turma_id = ? AND aluno_id = ?",
        [turmaId, usuario.id]
    );
    return linhas.length > 0;
}

// Lista somente as turmas do professor ou aquelas em que o aluno está matriculado.
router.get("/turmas", logado, async (req, res) => {
    try {
        const usuario = req.session.usuario;
        let linhas;

        if (ehEducador(usuario)) {
            [linhas] = await pool.execute(
                `SELECT t.id, t.nome, t.disciplina, t.secao, t.descricao,
                        t.video_room, t.criada_em, u.nome AS professor,
                        (SELECT COUNT(*) FROM tb_turma_alunos ta WHERE ta.turma_id = t.id) AS quantidade_alunos,
                        'educador' AS papel
                 FROM tb_turmas t
                 JOIN tb_usuarios u ON u.id = t.professor_id
                 WHERE t.professor_id = ?
                 ORDER BY t.criada_em DESC`,
                [usuario.id]
            );
        } else {
            [linhas] = await pool.execute(
                `SELECT t.id, t.nome, t.disciplina, t.secao, t.descricao,
                        t.video_room, t.criada_em, u.nome AS professor,
                        (SELECT COUNT(*) FROM tb_turma_alunos ta2 WHERE ta2.turma_id = t.id) AS quantidade_alunos,
                        'aluno' AS papel
                 FROM tb_turma_alunos ta
                 JOIN tb_turmas t ON t.id = ta.turma_id
                 JOIN tb_usuarios u ON u.id = t.professor_id
                 WHERE ta.aluno_id = ?
                 ORDER BY ta.entrou_em DESC`,
                [usuario.id]
            );
        }

        res.json({ turmas: linhas });
    } catch (erro) {
        console.error("Erro ao listar turmas:", erro);
        res.status(500).json({ erro: "Não foi possível carregar as turmas" });
    }
});

// O educador cria uma turma. O código é gerado no servidor e não pode ser escolhido pelo navegador.
router.post("/turmas", soEducador, async (req, res) => {
    try {
        const nome = String(req.body.nome || "").trim();
        const disciplina = String(req.body.disciplina || "").trim();
        const secao = String(req.body.secao || "").trim();
        const descricao = String(req.body.descricao || "").trim();

        if (!nome || nome.length > 120) {
            return res.status(400).json({ erro: "Informe um nome de turma com até 120 caracteres" });
        }
        if (!disciplina || disciplina.length > 120) {
            return res.status(400).json({ erro: "Informe a disciplina com até 120 caracteres" });
        }
        if (secao.length > 80 || descricao.length > 1000) {
            return res.status(400).json({ erro: "Confira o tamanho dos campos da turma" });
        }

        let resultado;
        let codigo;
        let tentativas = 0;
        do {
            codigo = crypto.randomBytes(4).toString("hex").toUpperCase();
            try {
                [resultado] = await pool.execute(
                    `INSERT INTO tb_turmas (nome, disciplina, secao, descricao, codigo, video_room, professor_id)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [nome, disciplina, secao || null, descricao || null, codigo,
                        "conrad-" + crypto.randomBytes(12).toString("hex"), req.session.usuario.id]
                );
                break;
            } catch (erro) {
                if (erro.code !== "ER_DUP_ENTRY" || tentativas >= 4) throw erro;
                tentativas++;
            }
        } while (tentativas <= 4);

        res.status(201).json({ id: resultado.insertId, codigo, mensagem: "Turma criada" });
    } catch (erro) {
        console.error("Erro ao criar turma:", erro);
        res.status(500).json({ erro: "Não foi possível criar a turma" });
    }
});

// O aluno usa o código de convite mostrado pelo professor.
router.post("/turmas/entrar", soAluno, async (req, res) => {
    try {
        const codigo = String(req.body.codigo || "").trim().replace(/\s+/g, "").toUpperCase();
        if (!/^[A-F0-9]{8}$/.test(codigo)) {
            return res.status(400).json({ erro: "Digite um código de turma válido" });
        }

        const [turmas] = await pool.execute(
            "SELECT id, nome FROM tb_turmas WHERE codigo = ?",
            [codigo]
        );
        if (!turmas.length) return res.status(404).json({ erro: "Nenhuma turma foi encontrada com esse código" });

        await pool.execute(
            "INSERT IGNORE INTO tb_turma_alunos (turma_id, aluno_id) VALUES (?, ?)",
            [turmas[0].id, req.session.usuario.id]
        );

        res.status(200).json({ mensagem: "Você entrou na turma", turma: turmas[0] });
    } catch (erro) {
        console.error("Erro ao entrar na turma:", erro);
        res.status(500).json({ erro: "Não foi possível entrar na turma" });
    }
});

// Detalhes da turma e lista de pessoas. O acesso é validado para professor ou aluno matriculado.
router.get("/turmas/:id", logado, async (req, res) => {
    try {
        const turmaId = Number(req.params.id);
        if (!Number.isInteger(turmaId) || turmaId <= 0) {
            return res.status(400).json({ erro: "Turma inválida" });
        }
        if (!(await usuarioPodeAcessarTurma(turmaId, req.session.usuario))) {
            return res.status(403).json({ erro: "Você não tem acesso a esta turma" });
        }

        const [turmas] = await pool.execute(
            `SELECT t.id, t.nome, t.disciplina, t.secao, t.descricao, t.codigo,
                    t.video_room, t.criada_em, u.nome AS professor, u.id AS professor_id,
                    (SELECT COUNT(*) FROM tb_turma_alunos ta WHERE ta.turma_id = t.id) AS quantidade_alunos
             FROM tb_turmas t
             JOIN tb_usuarios u ON u.id = t.professor_id
             WHERE t.id = ?`,
            [turmaId]
        );
        if (!turmas.length) return res.status(404).json({ erro: "Turma não encontrada" });

        const [alunos] = await pool.execute(
            `SELECT u.id, u.nome, ta.entrou_em
             FROM tb_turma_alunos ta
             JOIN tb_usuarios u ON u.id = ta.aluno_id
             WHERE ta.turma_id = ?
             ORDER BY u.nome`,
            [turmaId]
        );

        const turmaDetalhada = { ...turmas[0], papel: ehEducador(req.session.usuario) ? "educador" : "aluno" };
        if (!ehEducador(req.session.usuario)) delete turmaDetalhada.codigo;

        res.json({
            turma: turmaDetalhada,
            pessoas: [
                { id: turmas[0].professor_id, nome: turmas[0].professor, papel: "Professor" },
                ...alunos.map((aluno) => ({ id: aluno.id, nome: aluno.nome, papel: "Aluno" }))
            ]
        });
    } catch (erro) {
        console.error("Erro ao abrir turma:", erro);
        res.status(500).json({ erro: "Não foi possível abrir esta turma" });
    }
});

// O professor pode retirar um aluno da turma.
router.delete("/turmas/:id/alunos/:alunoId", soEducador, async (req, res) => {
    try {
        const turmaId = Number(req.params.id);
        const alunoId = Number(req.params.alunoId);
        if (!Number.isInteger(turmaId) || !Number.isInteger(alunoId)) {
            return res.status(400).json({ erro: "Identificador inválido" });
        }

        const [turmas] = await pool.execute(
            "SELECT id FROM tb_turmas WHERE id = ? AND professor_id = ?",
            [turmaId, req.session.usuario.id]
        );
        if (!turmas.length) return res.status(404).json({ erro: "Turma não encontrada" });

        await pool.execute(
            "DELETE FROM tb_turma_alunos WHERE turma_id = ? AND aluno_id = ?",
            [turmaId, alunoId]
        );
        res.json({ mensagem: "Aluno removido da turma" });
    } catch (erro) {
        console.error("Erro ao remover aluno:", erro);
        res.status(500).json({ erro: "Não foi possível remover o aluno" });
    }
});

module.exports = router;
