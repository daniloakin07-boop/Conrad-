// Backend do bate-papo privado entre educador e aluno.
// Uma conversa é identificada pela turma + educador + aluno.
const express = require("express");
const pool = require("./db.js");

const router = express.Router();
const LIMITE_HISTORICO = 100;
const LIMITE_ANEXO_BYTES = 3 * 1024 * 1024;

function exigirLogin(req, res, next) {
    if (!req.session?.usuario) {
        return res.status(401).json({ erro: "Faça login para acessar o bate-papo." });
    }
    next();
}

function ehEducador(usuario) {
    return usuario?.tipo === "educador";
}

function criarErro(status, mensagem) {
    const erro = new Error(mensagem);
    erro.status = status;
    return erro;
}

// Confere a matrícula e a titularidade da turma antes de autorizar a conversa.
async function obterConversa(turmaId, participanteId, usuario) {
    const turma = Number(turmaId);
    const participante = Number(participanteId);

    if (!Number.isSafeInteger(turma) || turma <= 0 ||
        !Number.isSafeInteger(participante) || participante <= 0 ||
        participante === Number(usuario.id)) {
        throw criarErro(400, "Selecione uma turma e um contato válidos.");
    }

    const educadorId = ehEducador(usuario) ? Number(usuario.id) : participante;
    const alunoId = ehEducador(usuario) ? participante : Number(usuario.id);

    const [linhas] = await pool.execute(
        `SELECT t.id AS turmaId, t.nome AS turmaNome, t.disciplina AS disciplina,
                educador.id AS educadorId, educador.nome AS educadorNome,
                aluno.id AS alunoId, aluno.nome AS alunoNome
         FROM tb_turmas t
         INNER JOIN tb_usuarios educador ON educador.id = t.professor_id
         INNER JOIN tb_turma_alunos matricula ON matricula.turma_id = t.id
         INNER JOIN tb_usuarios aluno ON aluno.id = matricula.aluno_id
         WHERE t.id = ? AND t.professor_id = ? AND matricula.aluno_id = ?
         LIMIT 1`,
        [turma, educadorId, alunoId]
    );

    if (!linhas.length) {
        throw criarErro(403, "A conversa só pode acontecer entre o educador responsável e um aluno matriculado nessa turma.");
    }

    const dados = linhas[0];
    const outro = ehEducador(usuario)
        ? { id: dados.alunoId, nome: dados.alunoNome, tipo: "aluno" }
        : { id: dados.educadorId, nome: dados.educadorNome, tipo: "educador" };

    return {
        turmaId: dados.turmaId,
        turmaNome: dados.turmaNome,
        disciplina: dados.disciplina,
        educadorId: dados.educadorId,
        educadorNome: dados.educadorNome,
        alunoId: dados.alunoId,
        alunoNome: dados.alunoNome,
        participante: outro
    };
}

// Retorna somente contatos com vínculo ativo em uma turma do usuário logado.
router.get("/contatos", exigirLogin, async (req, res) => {
    try {
        const usuario = req.session.usuario;
        let contatos;

        if (ehEducador(usuario)) {
            const [linhas] = await pool.execute(
                `SELECT t.id AS turmaId, t.nome AS turmaNome, t.disciplina,
                        aluno.id AS participanteId, aluno.nome AS participanteNome,
                        'Aluno' AS participantePapel
                 FROM tb_turmas t
                 INNER JOIN tb_turma_alunos matricula ON matricula.turma_id = t.id
                 INNER JOIN tb_usuarios aluno ON aluno.id = matricula.aluno_id
                 WHERE t.professor_id = ?
                 ORDER BY t.nome, aluno.nome`,
                [usuario.id]
            );
            contatos = linhas;
        } else {
            const [linhas] = await pool.execute(
                `SELECT t.id AS turmaId, t.nome AS turmaNome, t.disciplina,
                        educador.id AS participanteId, educador.nome AS participanteNome,
                        'Educador' AS participantePapel
                 FROM tb_turma_alunos matricula
                 INNER JOIN tb_turmas t ON t.id = matricula.turma_id
                 INNER JOIN tb_usuarios educador ON educador.id = t.professor_id
                 WHERE matricula.aluno_id = ?
                 ORDER BY t.nome, educador.nome`,
                [usuario.id]
            );
            contatos = linhas;
        }

        res.json({ contatos });
    } catch (erro) {
        console.error("Erro ao listar contatos do chat:", erro);
        res.status(500).json({ erro: "Não foi possível carregar seus contatos." });
    }
});

// Valida o destinatário também no carregamento inicial da conversa.
router.get("/contexto", exigirLogin, async (req, res) => {
    try {
        const conversa = await obterConversa(
            req.query.turmaId,
            req.query.participanteId,
            req.session.usuario
        );
        res.json({ conversa });
    } catch (erro) {
        res.status(erro.status || 500).json({ erro: erro.message || "Não foi possível abrir a conversa." });
    }
});

// Entrega um anexo somente ao educador e ao aluno daquela conversa.
router.get("/anexos/:id", exigirLogin, async (req, res) => {
    try {
        const anexoId = Number(req.params.id);
        if (!Number.isSafeInteger(anexoId) || anexoId <= 0) {
            return res.status(400).json({ erro: "Anexo inválido." });
        }

        const [linhas] = await pool.execute(
            `SELECT turma_id, educador_id, aluno_id, mime_type, nome_arquivo, conteudo
             FROM tb_chat_anexos WHERE id = ? LIMIT 1`,
            [anexoId]
        );
        if (!linhas.length) return res.status(404).json({ erro: "Anexo não encontrado." });

        const anexo = linhas[0];
        const usuario = req.session.usuario;
        const ehParticipante = Number(usuario.id) === Number(anexo.educador_id) ||
            Number(usuario.id) === Number(anexo.aluno_id);
        if (!ehParticipante) return res.status(403).json({ erro: "Você não tem acesso a este anexo." });

        // Além do ID, confirma que o vínculo da turma continua ativo.
        const outroId = Number(usuario.id) === Number(anexo.educador_id)
            ? anexo.aluno_id : anexo.educador_id;
        await obterConversa(anexo.turma_id, outroId, usuario);

        const nomeSeguro = String(anexo.nome_arquivo || "anexo")
            .replace(/["\\\r\n]/g, "_").slice(0, 180);
        res.set({
            "Content-Type": anexo.mime_type,
            "Content-Length": anexo.conteudo.length,
            "Content-Disposition": `inline; filename="${nomeSeguro}"`,
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff"
        });
        res.send(anexo.conteudo);
    } catch (erro) {
        res.status(erro.status || 403).json({ erro: erro.message || "Não foi possível acessar o anexo." });
    }
});

function validarMensagem(payload) {
    const tipo = payload?.tipo;
    const conteudo = typeof payload?.conteudo === "string" ? payload.conteudo.trim() : "";

    if (tipo === "texto") {
        if (!conteudo || conteudo.length > 2000) {
            throw criarErro(400, "A mensagem deve ter entre 1 e 2.000 caracteres.");
        }
        return { tipo, conteudo, mimeType: null, nomeArquivo: null };
    }

    if (tipo !== "imagem" && tipo !== "audio") {
        throw criarErro(400, "Tipo de mensagem não permitido.");
    }

    const correspondencia = conteudo.match(/^data:([^;,]+)(?:;[^,]*)?;base64,([A-Za-z0-9+/=\r\n]+)$/);
    if (!correspondencia) {
        throw criarErro(400, "O arquivo enviado não está em um formato válido.");
    }

    const mimeType = correspondencia[1].toLowerCase();
    const imagensPermitidas = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    const audiosPermitidos = ["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav", "audio/aac"];

    if (tipo === "imagem" && !imagensPermitidas.includes(mimeType)) {
        throw criarErro(400, "Envie uma imagem JPG, PNG, WEBP ou GIF.");
    }
    if (tipo === "audio" && !audiosPermitidos.includes(mimeType)) {
        throw criarErro(400, "O formato deste áudio não é compatível.");
    }

    const base64 = correspondencia[2].replace(/\s/g, "");
    const arquivo = Buffer.from(base64, "base64");
    if (!arquivo.length || arquivo.length > LIMITE_ANEXO_BYTES) {
        throw criarErro(413, "O anexo deve ter no máximo 3 MB.");
    }

    return {
        tipo,
        arquivo,
        mimeType,
        nomeArquivo: String(payload.nomeArquivo || (tipo === "imagem" ? "imagem" : "mensagem de voz")).slice(0, 255)
    };
}

function dataIso(valor) {
    const data = valor instanceof Date ? valor : new Date(valor);
    return Number.isNaN(data.getTime()) ? new Date().toISOString() : data.toISOString();
}

function formatarMensagem(linha) {
    return {
        id: linha.id,
        autorId: linha.autor_id,
        autor: linha.autor_nome,
        tipo: linha.tipo,
        conteudo: linha.conteudo,
        anexoUrl: linha.anexo_id ? `/api/chat/anexos/${linha.anexo_id}` : null,
        mimeType: linha.mime_type,
        nomeArquivo: linha.nome_arquivo,
        data: dataIso(linha.criada_em)
    };
}

function configurarSocket(io) {
    io.on("connection", (socket) => {
        const usuario = socket.request.session?.usuario;
        if (!usuario) {
            socket.disconnect(true);
            return;
        }

        socket.on("chat:entrar", async (dados, callback) => {
            const responder = typeof callback === "function" ? callback : () => {};
            try {
                const contexto = await obterConversa(dados?.turmaId, dados?.participanteId, usuario);

                if (socket.data.salaChat) await socket.leave(socket.data.salaChat);

                const sala = `conrad:${contexto.turmaId}:${contexto.educadorId}:${contexto.alunoId}`;
                await socket.join(sala);
                socket.data.salaChat = sala;
                socket.data.contextoChat = contexto;

                const [historico] = await pool.execute(
                    `SELECT id, autor_id, autor_nome, tipo, conteudo, anexo_id,
                            mime_type, nome_arquivo, criada_em
                     FROM tb_chat_mensagens
                     WHERE turma_id = ? AND educador_id = ? AND aluno_id = ?
                     ORDER BY id DESC LIMIT ?`,
                    [contexto.turmaId, contexto.educadorId, contexto.alunoId, LIMITE_HISTORICO]
                );

                responder({ ok: true, conversa: contexto, mensagens: historico.reverse().map(formatarMensagem) });
            } catch (erro) {
                responder({ ok: false, erro: erro.message || "Não foi possível entrar nesta conversa." });
            }
        });

        socket.on("chat:enviar", async (payload, callback) => {
            const responder = typeof callback === "function" ? callback : () => {};
            try {
                const conversaAtual = socket.data.contextoChat;
                if (!conversaAtual || !socket.data.salaChat) {
                    throw criarErro(403, "Entre em uma conversa antes de enviar mensagens.");
                }

                // Revalida a matrícula a cada envio, inclusive após remoção da turma.
                const contexto = await obterConversa(
                    conversaAtual.turmaId,
                    conversaAtual.participante.id,
                    usuario
                );
                const mensagem = validarMensagem(payload);

                // A gravação do anexo e da mensagem é transacional para não deixar arquivos órfãos.
                const conexao = await pool.getConnection();
                let resultado;
                let anexoId = null;
                try {
                    await conexao.beginTransaction();

                    if (mensagem.tipo !== "texto") {
                        const [anexoInserido] = await conexao.execute(
                            `INSERT INTO tb_chat_anexos
                                (turma_id, educador_id, aluno_id, autor_id,
                                 mime_type, nome_arquivo, tamanho_bytes, conteudo)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                            [contexto.turmaId, contexto.educadorId, contexto.alunoId,
                                usuario.id, mensagem.mimeType, mensagem.nomeArquivo,
                                mensagem.arquivo.length, mensagem.arquivo]
                        );
                        anexoId = anexoInserido.insertId;
                    }

                    [resultado] = await conexao.execute(
                        `INSERT INTO tb_chat_mensagens
                            (turma_id, educador_id, aluno_id, autor_id, autor_nome,
                             tipo, conteudo, anexo_id, mime_type, nome_arquivo)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [contexto.turmaId, contexto.educadorId, contexto.alunoId,
                            usuario.id, usuario.nome, mensagem.tipo,
                            mensagem.tipo === "texto" ? mensagem.conteudo : null,
                            anexoId, mensagem.mimeType, mensagem.nomeArquivo]
                    );
                    await conexao.commit();
                } catch (erroBanco) {
                    await conexao.rollback();
                    throw erroBanco;
                } finally {
                    conexao.release();
                }

                const mensagemSalva = {
                    id: resultado.insertId,
                    autorId: usuario.id,
                    autor: usuario.nome,
                    tipo: mensagem.tipo,
                    conteudo: mensagem.tipo === "texto" ? mensagem.conteudo : null,
                    anexoUrl: anexoId ? `/api/chat/anexos/${anexoId}` : null,
                    mimeType: mensagem.mimeType,
                    nomeArquivo: mensagem.nomeArquivo,
                    data: new Date().toISOString()
                };

                // Só os dois participantes que pertencem a esta turma recebem o evento.
                io.to(socket.data.salaChat).emit("chat:mensagem", mensagemSalva);
                responder({ ok: true, id: resultado.insertId });
            } catch (erro) {
                responder({ ok: false, erro: erro.message || "Não foi possível enviar a mensagem." });
            }
        });
    });
}

module.exports = { router, configurarSocket };
