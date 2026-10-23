const express = require("express");
const router = express.Router();

const pool = require("./db.js");

// Coloque aqui a validação de acesso do educador
function exigirEducador(req, res, next) {
    if (!req.session?.usuario) {
        return res.status(401).json({
            erro: "Faça login para acessar as médias."
        });
    }

    if (req.session.usuario.tipo !== "educador") {
        return res.status(403).json({
            erro: "Acesso permitido somente a educadores."
        });
    }

    next();
}

// A URL final será /api/medias
router.get("/medias", exigirEducador, async (req, res) => {
    try {
        // 1. Média por atividade avaliativa.
        const [mediasPorAtividade] = await pool.execute(`
            SELECT
                a.id AS atividadeId,
                a.titulo AS atividade,
                a.turma,
                a.disciplina,

                ROUND(
                    AVG((n.nota / a.valor_maximo) * 10),
                    2
                ) AS media,

                COUNT(n.id) AS quantidadeNotas

            FROM tb_atividades AS a

            LEFT JOIN tb_notas AS n
                ON n.atividade_id = a.id

            WHERE a.tipo = 'avaliacao'
              AND a.aplicada = 1
              AND a.valor_maximo > 0

            GROUP BY
                a.id,
                a.titulo,
                a.turma,
                a.disciplina,
                a.data_aplicacao

            ORDER BY a.data_aplicacao, a.id
        `);

        // 2. Média geral de cada aluno.
        const [mediasPorAluno] = await pool.execute(`
            SELECT
                u.id AS alunoId,
                u.nome AS aluno,

                ROUND(
                    AVG((n.nota / a.valor_maximo) * 10),
                    2
                ) AS media,

                COUNT(n.id) AS atividadesComNota

            FROM tb_usuarios AS u

            LEFT JOIN (
                tb_notas AS n

                INNER JOIN tb_atividades AS a
                    ON a.id = n.atividade_id
                   AND a.tipo = 'avaliacao'
                   AND a.aplicada = 1
                   AND a.valor_maximo > 0
            )
                ON n.aluno_id = u.id

            WHERE u.tipo = 'aluno'

            GROUP BY u.id, u.nome
            ORDER BY u.nome
        `);

        const [[resultadoMediaGeral]] = await pool.execute(`
            SELECT
                ROUND(
                    AVG((n.nota / a.valor_maximo) * 10),
                    2
                ) AS media,

                COUNT(n.id) AS quantidadeNotas,

                COUNT(DISTINCT a.id) AS quantidadeAtividades

            FROM tb_notas AS n

            INNER JOIN tb_atividades AS a
                ON a.id = n.atividade_id

            WHERE a.tipo = 'avaliacao'
              AND a.aplicada = 1
              AND a.valor_maximo > 0
        `);

        return res.json({
            mediasPorAtividade,
            mediasPorAluno,

             // Média global de todas as atividades avaliativas
            mediaTodasAtividades: {
                media: resultadoMediaGeral.media === null
                    ? null
                    : Number(resultadoMediaGeral.media),

                quantidadeNotas:
                    resultadoMediaGeral.quantidadeNotas,

                quantidadeAtividades:
                    resultadoMediaGeral.quantidadeAtividades
            }
        });

    } catch (error) {
        console.error("Erro ao calcular médias:", error);

        res.status(500).json({
            erro: "Não foi possível calcular as médias."
        });
    }
});

module.exports = router;