const express = require("express");
const router = express.Router();

// Como este arquivo está dentro da pasta JS, a conexão correta fica em ./db.js.
const pool = require("./db.js");

function exigirEducador(req, res, next) {
    if (!req.session?.usuario) {
        return res.status(401).json({ erro: "Faça login para acessar as médias." });
    }

    if (req.session.usuario.tipo !== "educador") {
        return res.status(403).json({ erro: "Acesso permitido somente a educadores." });
    }

    next();
}

// O boletim sempre usa o ID que veio da sessão. O navegador não pode pedir
// o boletim de outro estudante enviando um ID diferente pela URL.
function exigirEstudante(req, res, next) {
    if (!req.session?.usuario?.id) {
        return res.status(401).json({ erro: "Faça login para acessar seu boletim." });
    }

    if (req.session.usuario.tipo === "educador") {
        return res.status(403).json({ erro: "O boletim individual é destinado à conta do estudante." });
    }

    next();
}

function arredondar(valor, casas = 2) {
    const fator = 10 ** casas;
    return Math.round((Number(valor) + Number.EPSILON) * fator) / fator;
}

function numeroOuNulo(valor) {
    if (valor === null || valor === undefined || valor === "") return null;
    const numero = Number(String(valor).replace(",", "."));
    return Number.isFinite(numero) ? numero : null;
}

function obterNomeCampo(colunas, nomesPossiveis) {
    const nomes = new Map(colunas.map(coluna => [String(coluna.Field || coluna).toLowerCase(), String(coluna.Field || coluna)]));
    for (const nome of nomesPossiveis) {
        const encontrado = nomes.get(nome.toLowerCase());
        if (encontrado) return encontrado;
    }
    return null;
}

function separarNomesSala(valor) {
    return [...new Set(
        String(valor)
            .split(/\s*[·|;]\s*|\s+-\s+/)
            .map(parte => parte.trim())
            .filter(Boolean)
    )];
}

function detectarVinculoSala(aluno, colunasAtividade) {
    const camposTextoDoAluno = [
        "turma", "nome_turma", "turma_nome", "sala_virtual", "nome_sala", "sala", "classe"
    ];
    const camposTextoDaAtividade = ["turma", "nome_turma", "turma_nome", "sala_virtual", "nome_sala", "sala", "classe"];

    for (const campoAluno of camposTextoDoAluno) {
        const valor = aluno[campoAluno];
        if (typeof valor !== "string" || !valor.trim()) continue;

        const campoAtividade = obterNomeCampo(
            colunasAtividade.map(Field => ({ Field })),
            camposTextoDaAtividade
        );
        if (campoAtividade) {
            return {
                campoAtividade,
                valores: separarNomesSala(valor),
                salaOriginal: valor.trim(),
                tipo: "texto"
            };
        }
    }

    const camposIdDoAluno = ["turma_id", "id_turma", "sala_id", "id_sala", "sala_virtual_id"];
    const camposIdDaAtividade = ["turma_id", "id_turma", "sala_id", "id_sala", "sala_virtual_id"];

    for (const campoAluno of camposIdDoAluno) {
        const valor = aluno[campoAluno];
        if (valor === null || valor === undefined || valor === "") continue;

        const campoAtividade = obterNomeCampo(
            colunasAtividade.map(Field => ({ Field })),
            camposIdDaAtividade
        );
        if (campoAtividade) {
            return {
                campoAtividade,
                valores: [valor],
                salaOriginal: `Sala vinculada (código ${valor})`,
                tipo: "id"
            };
        }
    }

    return null;
}

// GET /api/medias — painel de médias gerais disponível para educadores.
router.get("/medias", exigirEducador, async (req, res) => {
    try {
        const [mediasPorAtividade] = await pool.execute(`
            SELECT
                a.id AS atividadeId,
                a.titulo AS atividade,
                a.turma,
                a.disciplina,
                ROUND(AVG((n.nota / a.valor_maximo) * 10), 2) AS media,
                COUNT(n.id) AS quantidadeNotas
            FROM tb_atividades AS a
            LEFT JOIN tb_notas AS n ON n.atividade_id = a.id
            WHERE a.avaliativa = 1
              AND a.aplicada = 1
              AND a.valor_maximo > 0
            GROUP BY a.id, a.titulo, a.turma, a.disciplina, a.data_aplicacao
            ORDER BY a.data_aplicacao, a.id
        `);

        const [mediasPorAluno] = await pool.execute(`
            SELECT
                u.id AS alunoId,
                u.nome AS aluno,
                ROUND(AVG((n.nota / a.valor_maximo) * 10), 2) AS media,
                COUNT(n.id) AS atividadesComNota
            FROM tb_usuarios AS u
            LEFT JOIN (
                tb_notas AS n
                INNER JOIN tb_atividades AS a
                    ON a.id = n.atividade_id
                   AND a.avaliativa = 1
                   AND a.aplicada = 1
                   AND a.valor_maximo > 0
            ) ON n.aluno_id = u.id
            WHERE u.tipo = 'estudante'
            GROUP BY u.id, u.nome
            ORDER BY u.nome
        `);

        const [[resultadoMediaGeral]] = await pool.execute(`
            SELECT
                ROUND(AVG((n.nota / a.valor_maximo) * 10), 2) AS media,
                COUNT(n.id) AS quantidadeNotas,
                COUNT(DISTINCT a.id) AS quantidadeAtividades
            FROM tb_notas AS n
            INNER JOIN tb_atividades AS a ON a.id = n.atividade_id
            WHERE a.avaliativa = 1
              AND a.aplicada = 1
              AND a.valor_maximo > 0
        `);

        return res.json({
            mediasPorAtividade,
            mediasPorAluno,
            mediaTodasAtividades: {
                media: resultadoMediaGeral.media === null ? null : Number(resultadoMediaGeral.media),
                quantidadeNotas: resultadoMediaGeral.quantidadeNotas,
                quantidadeAtividades: resultadoMediaGeral.quantidadeAtividades
            }
        });
    } catch (error) {
        console.error("Erro ao calcular médias:", error);
        return res.status(500).json({ erro: "Não foi possível calcular as médias." });
    }
});

// GET /api/boletim — boletim do próprio estudante autenticado.
router.get("/boletim", exigirEstudante, async (req, res) => {
    try {
        const alunoId = Number(req.session.usuario.id);
        if (!Number.isInteger(alunoId) || alunoId <= 0) {
            return res.status(400).json({ erro: "A sessão do estudante é inválida." });
        }

        const [usuarios] = await pool.execute(
            "SELECT * FROM tb_usuarios WHERE id = ? LIMIT 1",
            [alunoId]
        );
        if (!usuarios.length) {
            return res.status(404).json({ erro: "Não foi possível localizar o cadastro do estudante." });
        }
        const aluno = usuarios[0];

        // Detecta nomes de colunas existentes sem depender de um único padrão
        // para a data de envio/resolução. Isso evita consultar uma coluna que não existe.
        const [colunasNotas] = await pool.execute("SHOW COLUMNS FROM tb_notas");
        const [colunasAtividades] = await pool.execute("SHOW COLUMNS FROM tb_atividades");
        const nomesColunasAtividade = colunasAtividades.map(coluna => coluna.Field);
        const campoDataRealizada = obterNomeCampo(colunasNotas, [
            "data_realizada", "data_feita", "data_entrega", "data_submissao",
            "data_envio", "data_entregue", "data_conclusao", "submitted_at",
            "sent_at", "entrega_em", "entregue_em", "realizado_em", "concluido_em"
        ]);

        const campoDataSelect = campoDataRealizada
            ? `n.\`${campoDataRealizada}\` AS dataRealizada`
            : "NULL AS dataRealizada";

        const vinculoSala = detectarVinculoSala(aluno, nomesColunasAtividade);
        const camposComuns = `
            SELECT
                n.id AS notaId,
                n.nota AS nota,
                ${campoDataSelect},
                a.id AS atividadeId,
                a.titulo AS atividade,
                a.disciplina AS disciplina,
                a.turma AS turma,
                a.data_aplicacao AS dataAplicacao,
                a.valor_maximo AS valorMaximo
        `;

        let consulta;
        let parametros;

        if (vinculoSala) {
            // Com vínculo entre usuário e turma, o LEFT JOIN também lista
            // atividades da sala sem nota lançada para este estudante.
            const campoSala = `a.\`${vinculoSala.campoAtividade}\``;
            let condicaoSala;
            if (vinculoSala.tipo === "texto") {
                const marcadores = vinculoSala.valores.map(() => "?").join(", ");
                condicaoSala = `LOWER(TRIM(${campoSala})) IN (${marcadores})`;
                parametros = [alunoId, ...vinculoSala.valores.map(valor => String(valor).toLowerCase())];
            } else {
                condicaoSala = `${campoSala} = ?`;
                parametros = [alunoId, vinculoSala.valores[0]];
            }

            consulta = `${camposComuns}
                FROM tb_atividades AS a
                LEFT JOIN tb_notas AS n
                    ON n.atividade_id = a.id
                   AND n.aluno_id = ?
                WHERE a.avaliativa = 1
                  AND a.aplicada = 1
                  AND a.valor_maximo > 0
                  AND ${condicaoSala}
                ORDER BY a.data_aplicacao, a.id
            `;
        } else {
            // No esquema atual não há vínculo confiável entre estudante e sala.
            // Nesse cenário, limitamos o relatório às notas que pertencem ao ID
            // autenticado, em vez de mostrar notas de outros alunos.
            consulta = `${camposComuns}
                FROM tb_notas AS n
                INNER JOIN tb_atividades AS a ON a.id = n.atividade_id
                WHERE n.aluno_id = ?
                  AND a.avaliativa = 1
                  AND a.aplicada = 1
                  AND a.valor_maximo > 0
                ORDER BY a.data_aplicacao, a.id
            `;
            parametros = [alunoId];
        }

        const [linhas] = await pool.execute(consulta, parametros);
        const atividades = linhas.map(linha => {
            const nota = numeroOuNulo(linha.nota);
            const valorMaximo = numeroOuNulo(linha.valorMaximo);
            const notaEscala10 = nota !== null && valorMaximo !== null && valorMaximo > 0
                ? arredondar((nota / valorMaximo) * 10)
                : null;

            return {
                atividadeId: linha.atividadeId,
                atividade: linha.atividade,
                disciplina: linha.disciplina,
                turma: linha.turma,
                dataAplicacao: linha.dataAplicacao,
                dataRealizada: linha.dataRealizada,
                notaId: linha.notaId,
                nota,
                valorMaximo,
                notaEscala10
            };
        });

        const notasValidas = atividades
            .map(atividade => atividade.notaEscala10)
            .filter(nota => nota !== null && Number.isFinite(nota));
        const mediaGeral = notasValidas.length
            ? arredondar(notasValidas.reduce((soma, nota) => soma + nota, 0) / notasValidas.length)
            : null;

        const turmasEncontradas = [...new Set(atividades.map(item => item.turma).filter(Boolean))];
        let salaVirtual = "Não identificada";
        if (vinculoSala) {
            salaVirtual = vinculoSala.salaOriginal;
        } else if (turmasEncontradas.length === 1) {
            salaVirtual = turmasEncontradas[0];
        } else if (turmasEncontradas.length > 1) {
            salaVirtual = turmasEncontradas.join(", ");
        }

        return res.json({
            aluno: {
                id: aluno.id,
                nome: aluno.nome || req.session.usuario.nome || "Estudante"
            },
            salaVirtual,
            vinculoSalaDetectado: Boolean(vinculoSala),
            dataRealizadaDisponivel: Boolean(campoDataRealizada),
            geradoEm: new Date().toISOString(),
            totalAtividades: atividades.length,
            totalNotas: notasValidas.length,
            mediaGeral,
            atividades
        });
    } catch (error) {
        console.error("Erro ao gerar boletim individual:", error);
        return res.status(500).json({
            erro: "Não foi possível gerar o boletim. Confira a estrutura das tabelas tb_usuarios, tb_atividades e tb_notas."
        });
    }
});

module.exports = router;
