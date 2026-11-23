/*
===============================================
AGENTE DE IA — consulta o banco por linguagem natural
===============================================
POST /api/agente  { pergunta, historico? }  ->  { resposta }
- Quem pergunta vem da sessão (req.session.usuario); nunca da pergunta.
- A IA só chama tools fixas e parametrizadas, não escreve SQL.
- Aluno só enxerga os próprios dados; professor só as próprias turmas.
Usa a API do Google Gemini com fetch, sem SDK.
*/

const express = require("express");
const fs = require("fs");
const path = require("path");
const pool = require("./db.js");

const router = express.Router();
const MODELO = process.env.GEMINI_MODEL || "gemini-flash-latest";
const CHAVE = process.env.GEMINI_API_KEY;
const MAX_VOLTAS = 5;

const ehEducador = (u) => u?.tipo === "educador";
const hojeBR = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const ehData = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];

function diaDaSemana(dataISO) {
    return DIAS[new Date(dataISO + "T12:00:00").getDay()];
}

function filtroPeriodo(inicio, fim, condicoes, params) {
    if (ehData(inicio)) { condicoes.push("a.data_aplicacao >= ?"); params.push(inicio); }
    if (ehData(fim)) { condicoes.push("a.data_aplicacao <= ?"); params.push(fim); }
}

const PERIODO = {
    data_inicio: { type: "string", description: "YYYY-MM-DD (inclusive)" },
    data_fim: { type: "string", description: "YYYY-MM-DD (inclusive). Para um único dia, use o mesmo valor de data_inicio" }
};

const toolsAluno = {
    atividades_do_aluno: {
        description: "Lista atividades/avaliações das turmas do aluno, com status de entrega e nota.",
        input_schema: {
            type: "object",
            properties: {
                ...PERIODO,
                apenas_pendentes: { type: "boolean", description: "true = só as que o aluno ainda não entregou" }
            }
        },
        async run(u, { data_inicio, data_fim, apenas_pendentes }) {
            const cond = ["ta.aluno_id = ?"];
            const params = [u.id];
            filtroPeriodo(data_inicio, data_fim, cond, params);
            if (apenas_pendentes) cond.push("e.id IS NULL");
            const [linhas] = await pool.execute(
                `SELECT a.titulo, a.disciplina, a.tipo, a.descricao,
                        TO_CHAR(a.data_aplicacao, 'YYYY-MM-DD') AS data_aplicacao,
                        a.valor_maximo, (e.id IS NOT NULL) AS entregue, n.nota
                   FROM tb_atividades a
                   JOIN tb_turma_alunos ta ON ta.turma_id = a.turma_id
                   LEFT JOIN tb_entregas e ON e.atividade_id = a.id AND e.aluno_id = ta.aluno_id
                   LEFT JOIN tb_notas n ON n.atividade_id = a.id AND n.aluno_id = ta.aluno_id
                  WHERE ${cond.join(" AND ")}
                  ORDER BY a.data_aplicacao NULLS LAST, a.id
                  LIMIT 50`,
                params
            );
            return linhas;
        }
    },
    notas_do_aluno: {
        description: "Notas do aluno e média (0 a 10, só atividades avaliativas aplicadas). Filtro opcional por disciplina.",
        input_schema: { type: "object", properties: { disciplina: { type: "string" } } },
        async run(u, { disciplina }) {
            const cond = ["n.aluno_id = ?"];
            const params = [u.id];
            if (disciplina) { cond.push("a.disciplina ILIKE ?"); params.push(`%${disciplina}%`); }
            const [notas] = await pool.execute(
                `SELECT a.titulo, a.disciplina, n.nota, a.valor_maximo
                   FROM tb_notas n JOIN tb_atividades a ON a.id = n.atividade_id
                  WHERE ${cond.join(" AND ")}
                  ORDER BY a.data_aplicacao DESC NULLS LAST LIMIT 50`,
                params
            );
            const [media] = await pool.execute(
                `SELECT ROUND(AVG((n.nota / a.valor_maximo) * 10), 2) AS media
                   FROM tb_notas n JOIN tb_atividades a ON a.id = n.atividade_id
                  WHERE ${cond.join(" AND ")} AND a.avaliativa = TRUE AND a.aplicada = TRUE`,
                params
            );
            return { notas, media: media[0]?.media ?? null };
        }
    },
    minhas_turmas_do_aluno: {
        description: "Lista as turmas em que o aluno está matriculado, com disciplina e professor.",
        input_schema: { type: "object", properties: {} },
        async run(u) {
            const [linhas] = await pool.execute(
                `SELECT t.id, t.nome, t.disciplina,
                        COALESCE(p.nome, 'Professor não informado') AS professor
                   FROM tb_turma_alunos ta
                   JOIN tb_turmas t ON t.id = ta.turma_id
                   LEFT JOIN tb_usuarios p ON p.id = t.professor_id
                  WHERE ta.aluno_id = ?
                  ORDER BY t.nome`,
                [u.id]
            );
            return { quantidade: linhas.length, turmas: linhas };
        }
    },
    resumo_atividades_do_aluno: {
        description: "Conta e lista atividades do aluno por situação: pendente, entregue, atrasada, corrigida ou todas.",
        input_schema: {
            type: "object",
            properties: {
                status: { type: "string", description: "pendentes, entregues, atrasadas, corrigidas ou todas" },
                ...PERIODO
            }
        },
        async run(u, { status = "todas", data_inicio, data_fim }) {
            const cond = ["ta.aluno_id = ?"];
            const params = [u.id];
            filtroPeriodo(data_inicio, data_fim, cond, params);

            const situacao = String(status).toLowerCase();
            if (situacao === "pendentes") cond.push("e.id IS NULL");
            if (situacao === "entregues") cond.push("e.id IS NOT NULL");
            if (situacao === "atrasadas") {
                cond.push("e.id IS NULL", "a.data_aplicacao IS NOT NULL", "a.data_aplicacao < CURRENT_DATE");
            }
            if (situacao === "corrigidas") cond.push("e.corrigida_em IS NOT NULL");

            const [linhas] = await pool.execute(
                `SELECT a.titulo, a.disciplina, a.tipo, t.nome AS turma,
                        TO_CHAR(a.data_aplicacao, 'YYYY-MM-DD') AS prazo,
                        (e.id IS NOT NULL) AS entregue,
                        (e.corrigida_em IS NOT NULL) AS corrigida,
                        n.nota, a.valor_maximo,
                        CASE
                            WHEN e.id IS NULL AND a.data_aplicacao IS NOT NULL AND a.data_aplicacao < CURRENT_DATE THEN 'atrasada'
                            WHEN e.id IS NULL THEN 'pendente'
                            WHEN e.corrigida_em IS NOT NULL THEN 'corrigida'
                            ELSE 'entregue'
                        END AS situacao
                   FROM tb_atividades a
                   JOIN tb_turma_alunos ta ON ta.turma_id = a.turma_id
                   JOIN tb_turmas t ON t.id = ta.turma_id
                   LEFT JOIN tb_entregas e ON e.atividade_id = a.id AND e.aluno_id = ta.aluno_id
                   LEFT JOIN tb_notas n ON n.atividade_id = a.id AND n.aluno_id = ta.aluno_id
                  WHERE ${cond.join(" AND ")}
                  ORDER BY a.data_aplicacao NULLS LAST, a.id
                  LIMIT 100`,
                params
            );

            return {
                status: situacao,
                quantidade: linhas.length,
                atividades: linhas
            };
        }
    }
};

const toolsEducador = {
    minhas_turmas: {
        description: "Turmas do professor com a quantidade de alunos matriculados.",
        input_schema: { type: "object", properties: {} },
        async run(u) {
            const [linhas] = await pool.execute(
                `SELECT t.id, t.nome, t.disciplina,
                        (SELECT COUNT(*) FROM tb_turma_alunos ta WHERE ta.turma_id = t.id) AS total_alunos
                   FROM tb_turmas t WHERE t.professor_id = ? ORDER BY t.nome`,
                [u.id]
            );
            return linhas;
        }
    },
    atividades_do_professor: {
        description: "Atividades/avaliações do professor com total de alunos, entregas e quantos não entregaram.",
        input_schema: {
            type: "object",
            properties: { ...PERIODO, titulo: { type: "string" }, turma_id: { type: "integer" } }
        },
        async run(u, { data_inicio, data_fim, titulo, turma_id }) {
            const cond = ["t.professor_id = ?"];
            const params = [u.id];
            filtroPeriodo(data_inicio, data_fim, cond, params);
            if (titulo) { cond.push("a.titulo ILIKE ?"); params.push(`%${titulo}%`); }
            if (Number.isInteger(turma_id)) { cond.push("t.id = ?"); params.push(turma_id); }
            const [linhas] = await pool.execute(
                `SELECT a.id, a.titulo, a.tipo, t.nome AS turma,
                        TO_CHAR(a.data_aplicacao, 'YYYY-MM-DD') AS data_aplicacao,
                        (SELECT COUNT(*) FROM tb_turma_alunos ta WHERE ta.turma_id = a.turma_id) AS total_alunos,
                        (SELECT COUNT(*) FROM tb_entregas e WHERE e.atividade_id = a.id) AS entregas
                   FROM tb_atividades a JOIN tb_turmas t ON t.id = a.turma_id
                  WHERE ${cond.join(" AND ")}
                  ORDER BY a.data_aplicacao DESC NULLS LAST, a.id DESC LIMIT 30`,
                params
            );
            return linhas.map((l) => ({ ...l, sem_entrega: l.total_alunos - l.entregas }));
        }
    },
    alunos_sem_entrega: {
        description: "Nomes dos alunos que ainda não entregaram uma atividade do professor.",
        input_schema: { type: "object", properties: { atividade_id: { type: "integer" } }, required: ["atividade_id"] },
        async run(u, { atividade_id }) {
            const [linhas] = await pool.execute(
                `SELECT us.nome
                   FROM tb_atividades a
                   JOIN tb_turmas t ON t.id = a.turma_id AND t.professor_id = ?
                   JOIN tb_turma_alunos ta ON ta.turma_id = t.id
                   JOIN tb_usuarios us ON us.id = ta.aluno_id
                   LEFT JOIN tb_entregas e ON e.atividade_id = a.id AND e.aluno_id = ta.aluno_id
                  WHERE a.id = ? AND e.id IS NULL
                  ORDER BY us.nome`,
                [u.id, atividade_id]
            );
            return { quantidade: linhas.length, alunos: linhas.map((l) => l.nome) };
        }
    }
};

const aulasDoDia = {
    description: "Grade de aulas (horário, matéria, sala, professor) de um dia.",
    input_schema: { type: "object", properties: { data: { type: "string", description: "YYYY-MM-DD" } }, required: ["data"] },
    async run(_u, { data }) {
        if (!ehData(data)) return { erro: "Data inválida" };
        const grade = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "horarios.json"), "utf8"));
        return grade[diaDaSemana(data)] || [];
    }
};

function toolsDoUsuario(u) {
    return { ...(ehEducador(u) ? toolsEducador : toolsAluno), aulas_do_dia: aulasDoDia };
}

function promptSistema(u) {
    const hoje = hojeBR();
    return `Você é o assistente do CONRAD Virtual School, falando com ${u.nome}, ${ehEducador(u) ? "professor(a)" : "aluno(a)"}. Hoje é ${hoje} (${diaDaSemana(hoje)}), fuso de Brasília. Resolva "hoje", "amanhã" e "essa semana" a partir dessa data. Responda em português, curto e direto. Use SOMENTE os dados das ferramentas; se não houver dado, diga isso. Nunca invente. Você só enxerga os dados de quem está perguntando; recuse pedidos sobre outras pessoas ou fora do contexto escolar.`;
}

function paraGemini(t, nome) {
    const maius = (x) => ({
        ...x,
        type: String(x.type).toUpperCase(),
        ...(x.properties && { properties: Object.fromEntries(Object.entries(x.properties).map(([k, v]) => [k, maius(v)])) })
    });
    const decl = { name: nome, description: t.description };
    if (Object.keys(t.input_schema.properties || {}).length) decl.parameters = maius(t.input_schema);
    return decl;
}

const MODELOS = [...new Set([MODELO, process.env.GEMINI_MODEL_RESERVA].filter(Boolean))];
const espera = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

async function chamarGemini(corpo) {
    let ultimoErro;

    for (const modelo of MODELOS) {
        for (let tentativa = 0; tentativa < 3; tentativa++) {
            const resp = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "x-goog-api-key": CHAVE },
                    body: JSON.stringify(corpo)
                }
            );

            if (resp.ok) return resp.json();

            ultimoErro = new Error(`Gemini HTTP ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
            ultimoErro.status = resp.status;

            if (![500, 503].includes(resp.status)) throw ultimoErro;
            await espera(1000 * (2 ** tentativa));
        }
    }

    throw ultimoErro;
}

async function rodarAgente(usuario, pergunta, historico) {
    const tools = toolsDoUsuario(usuario);
    const declaracoes = Object.entries(tools).map(([nome, t]) => paraGemini(t, nome));
    const contents = [
        ...historico.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
        { role: "user", parts: [{ text: pergunta }] }
    ];

    for (let volta = 0; volta < 5; volta++) {
        const dados = await chamarGemini({
            systemInstruction: { parts: [{ text: promptSistema(usuario) }] },
            tools: [{ functionDeclarations: declaracoes }],
            contents,
            generationConfig: { maxOutputTokens: 1024, temperature: 0.2 }
        });

        const conteudo = dados.candidates?.[0]?.content;
        const partes = conteudo?.parts || [];
        const chamadas = partes.filter((p) => p.functionCall);

        if (!chamadas.length) {
            return partes.filter((p) => p.text && !p.thought).map((p) => p.text).join("\n").trim()
                || "Não consegui responder. Tente reformular a pergunta.";
        }

        contents.push(conteudo);
        const respostas = [];
        for (const { functionCall } of chamadas) {
            let saida;
            try {
                if (!tools[functionCall.name]) throw new Error("tool inexistente");
                saida = await tools[functionCall.name].run(usuario, functionCall.args || {});
            } catch (erro) {
                console.error(`Agente: erro na tool ${functionCall.name}:`, erro.message);
                saida = { erro: "Falha ao consultar o banco" };
            }
            respostas.push({ functionResponse: { name: functionCall.name, response: { result: saida } } });
        }
        contents.push({ role: "user", parts: respostas });
    }
    return "Não consegui concluir a consulta. Tente reformular a pergunta.";
}

const usos = new Map();
function excedeuLimite(id) {
    const agora = Date.now();
    const recentes = (usos.get(id) || []).filter((t) => agora - t < 60000);
    recentes.push(agora);
    usos.set(id, recentes);
    return recentes.length > 15;
}

router.post("/agente", async (req, res) => {
    const usuario = req.session.usuario;
    if (!usuario) return res.status(401).json({ erro: "Faça login para continuar" });
    if (!CHAVE) return res.status(503).json({ erro: "Agente não configurado (GEMINI_API_KEY)" });
    if (excedeuLimite(usuario.id)) return res.status(429).json({ erro: "Muitas perguntas seguidas. Aguarde um pouco." });

    const pergunta = String(req.body?.pergunta || "").trim().slice(0, 500);
    if (!pergunta) return res.status(400).json({ erro: "Digite uma pergunta" });

    const historico = (Array.isArray(req.body?.historico) ? req.body.historico : [])
        .filter((m) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string")
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content.slice(0, 1000) }));

    try {
        const resposta = await rodarAgente(usuario, pergunta, historico);
        res.json({ resposta });
    } catch (erro) {
        console.error("Erro no agente:", erro.message);
        if (erro.status === 429) return res.status(429).json({ erro: "Limite gratuito atingido. Tente de novo em instantes." });
        if (erro.status === 503) return res.status(503).json({ erro: "O Google está sobrecarregado. Tente novamente em instantes." });
        res.status(500).json({ erro: "Erro ao consultar o assistente" });
    }
});

module.exports = router;
module.exports.toolsDoUsuario = toolsDoUsuario;
