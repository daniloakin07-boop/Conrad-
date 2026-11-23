-- ============================================================================
-- Arquivo   : JS/migrations/supabase-schema-corrigido.sql
-- Finalidade: ESQUEMA COMPLETO e atual do banco (PostgreSQL/Supabase), para um projeto vazio.
-- Como usar : cole e execute no "SQL Editor" do Supabase. Todos os comandos usam IF NOT EXISTS.
-- Mapa das tabelas (as relações estão descritas em docs/DOCUMENTACAO_TECNICA_E_GUIA_DE_ESTUDO.md):
--   tb_usuarios        contas (aluno | educador)          tb_contatos       mensagens do "Fale conosco"
--   tb_sessoes         sessões persistentes (hoje sem uso) tb_perfis_alunos  perfil complementar do aluno
--   tb_turmas          turmas + código + sala de vídeo     tb_turma_alunos   matrículas (N:N aluno x turma)
--   tb_atividades      atividades e avaliações             tb_entregas       respostas dos alunos
--   tb_notas           notas por atividade/aluno           tb_questoes / tb_respostas / tb_inicios
--                                                          (recurso de questões, ainda não integrado)
--   tb_chat_mensagens / tb_chat_anexos   bate-papo privado
-- Convenções: chaves primárias BIGINT identity; datas TIMESTAMPTZ; FKs com ON DELETE CASCADE/SET NULL.
-- ============================================================================

-- Esquema PostgreSQL/Supabase do Conrad Virtual School.
-- Execute no SQL Editor do Supabase em um projeto vazio.
-- O backend do projeto usa PostgreSQL com o driver pg.

CREATE TABLE IF NOT EXISTS public.tb_usuarios (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    senha VARCHAR(255) NOT NULL,
    tipo VARCHAR(20) NOT NULL,
    turma VARCHAR(80),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_tb_usuarios_tipo CHECK (tipo IN ('aluno', 'educador'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tb_usuarios_email_lower
    ON public.tb_usuarios (LOWER(email));

CREATE TABLE IF NOT EXISTS public.tb_contatos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL,
    mensagem TEXT NOT NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tb_sessoes (
    sid VARCHAR(128) PRIMARY KEY,
    dados TEXT NOT NULL,
    expira_em BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tb_sessoes_expira_em
    ON public.tb_sessoes (expira_em);

CREATE TABLE IF NOT EXISTS public.tb_perfis_alunos (
    usuario_id BIGINT PRIMARY KEY,
    sobre_mim VARCHAR(800),
    interesses TEXT,
    habilidades TEXT,
    foto_perfil TEXT,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_tb_perfis_usuario
        FOREIGN KEY (usuario_id) REFERENCES public.tb_usuarios(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.tb_turmas (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome VARCHAR(120) NOT NULL,
    disciplina VARCHAR(120) NOT NULL,
    secao VARCHAR(80),
    descricao VARCHAR(1000),
    codigo CHAR(8) NOT NULL UNIQUE,
    video_room VARCHAR(80) NOT NULL UNIQUE,
    professor_id BIGINT NOT NULL,
    criada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_tb_turmas_professor
        FOREIGN KEY (professor_id) REFERENCES public.tb_usuarios(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tb_turmas_professor
    ON public.tb_turmas (professor_id);

CREATE TABLE IF NOT EXISTS public.tb_turma_alunos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    turma_id BIGINT NOT NULL,
    aluno_id BIGINT NOT NULL,
    entrou_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tb_turma_aluno UNIQUE (turma_id, aluno_id),
    CONSTRAINT fk_tb_matricula_turma
        FOREIGN KEY (turma_id) REFERENCES public.tb_turmas(id) ON DELETE CASCADE,
    CONSTRAINT fk_tb_matricula_aluno
        FOREIGN KEY (aluno_id) REFERENCES public.tb_usuarios(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tb_turma_alunos_aluno
    ON public.tb_turma_alunos (aluno_id);

CREATE INDEX IF NOT EXISTS idx_tb_turma_alunos_turma
    ON public.tb_turma_alunos (turma_id);

CREATE TABLE IF NOT EXISTS public.tb_atividades (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    titulo VARCHAR(160) NOT NULL,
    turma VARCHAR(80) NOT NULL,
    turma_id BIGINT,
    disciplina VARCHAR(120) NOT NULL,
    data_aplicacao DATE,
    valor_maximo NUMERIC(7,2) NOT NULL DEFAULT 10.00,
    descricao TEXT,
    tipo VARCHAR(20) NOT NULL DEFAULT 'atividade'
        CONSTRAINT chk_tb_atividades_tipo CHECK (tipo IN ('atividade', 'avaliacao')),
    tempo_limite_min INTEGER,
    avaliativa BOOLEAN NOT NULL DEFAULT FALSE,
    aplicada BOOLEAN NOT NULL DEFAULT FALSE,
    criado_por BIGINT,
    criada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_tb_atividades_turma
        FOREIGN KEY (turma_id) REFERENCES public.tb_turmas(id) ON DELETE SET NULL,
    CONSTRAINT fk_tb_atividades_criador
        FOREIGN KEY (criado_por) REFERENCES public.tb_usuarios(id) ON DELETE SET NULL,
    CONSTRAINT chk_tb_atividades_tempo
        CHECK (tempo_limite_min IS NULL OR tempo_limite_min > 0)
);

CREATE INDEX IF NOT EXISTS idx_tb_atividades_turma
    ON public.tb_atividades (turma_id);

CREATE INDEX IF NOT EXISTS idx_tb_atividades_media
    ON public.tb_atividades (avaliativa, aplicada);

CREATE TABLE IF NOT EXISTS public.tb_entregas (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    atividade_id BIGINT NOT NULL,
    aluno_id BIGINT NOT NULL,
    resposta TEXT NOT NULL,
    enviada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    feedback TEXT,
    corrigida_em TIMESTAMPTZ,
    CONSTRAINT uq_tb_entregas_atividade_aluno UNIQUE (atividade_id, aluno_id),
    CONSTRAINT fk_tb_entregas_atividade
        FOREIGN KEY (atividade_id) REFERENCES public.tb_atividades(id) ON DELETE CASCADE,
    CONSTRAINT fk_tb_entregas_aluno
        FOREIGN KEY (aluno_id) REFERENCES public.tb_usuarios(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tb_entregas_aluno
    ON public.tb_entregas (aluno_id);

CREATE TABLE IF NOT EXISTS public.tb_notas (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    atividade_id BIGINT NOT NULL,
    aluno_id BIGINT NOT NULL,
    nota NUMERIC(7,2) NOT NULL,
    atualizada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tb_notas_atividade_aluno UNIQUE (atividade_id, aluno_id),
    CONSTRAINT fk_tb_notas_atividade
        FOREIGN KEY (atividade_id) REFERENCES public.tb_atividades(id) ON DELETE CASCADE,
    CONSTRAINT fk_tb_notas_aluno
        FOREIGN KEY (aluno_id) REFERENCES public.tb_usuarios(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tb_notas_aluno
    ON public.tb_notas (aluno_id);

CREATE TABLE IF NOT EXISTS public.tb_questoes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    atividade_id BIGINT NOT NULL,
    ordem INTEGER NOT NULL,
    tipo VARCHAR(20) NOT NULL,
    enunciado TEXT NOT NULL,
    pontos NUMERIC(7,2) NOT NULL DEFAULT 1.00,
    alternativas TEXT,
    correta INTEGER,
    CONSTRAINT uq_tb_questoes_atividade_ordem UNIQUE (atividade_id, ordem),
    CONSTRAINT fk_tb_questoes_atividade
        FOREIGN KEY (atividade_id) REFERENCES public.tb_atividades(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.tb_respostas (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    entrega_id BIGINT NOT NULL,
    questao_id BIGINT NOT NULL,
    resposta TEXT,
    alternativa INTEGER,
    pontos NUMERIC(7,2),
    comentario TEXT,
    CONSTRAINT uq_tb_respostas_entrega_questao UNIQUE (entrega_id, questao_id),
    CONSTRAINT fk_tb_respostas_entrega
        FOREIGN KEY (entrega_id) REFERENCES public.tb_entregas(id) ON DELETE CASCADE,
    CONSTRAINT fk_tb_respostas_questao
        FOREIGN KEY (questao_id) REFERENCES public.tb_questoes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tb_respostas_questao
    ON public.tb_respostas (questao_id);

CREATE TABLE IF NOT EXISTS public.tb_inicios (
    atividade_id BIGINT NOT NULL,
    aluno_id BIGINT NOT NULL,
    iniciada_ms BIGINT NOT NULL,
    PRIMARY KEY (atividade_id, aluno_id),
    CONSTRAINT fk_tb_inicios_atividade
        FOREIGN KEY (atividade_id) REFERENCES public.tb_atividades(id) ON DELETE CASCADE,
    CONSTRAINT fk_tb_inicios_aluno
        FOREIGN KEY (aluno_id) REFERENCES public.tb_usuarios(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.tb_chat_anexos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    turma_id BIGINT NOT NULL,
    educador_id BIGINT NOT NULL,
    aluno_id BIGINT NOT NULL,
    autor_id BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    nome_arquivo VARCHAR(255),
    tamanho_bytes BIGINT NOT NULL,
    conteudo BYTEA NOT NULL,
    criada_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tb_chat_anexo_participantes
    ON public.tb_chat_anexos (turma_id, educador_id, aluno_id);

CREATE TABLE IF NOT EXISTS public.tb_chat_mensagens (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    turma_id BIGINT NOT NULL,
    educador_id BIGINT NOT NULL,
    aluno_id BIGINT NOT NULL,
    autor_id BIGINT NOT NULL,
    autor_nome VARCHAR(150) NOT NULL,
    tipo VARCHAR(10) NOT NULL DEFAULT 'texto'
        CONSTRAINT chk_tb_chat_tipo CHECK (tipo IN ('texto', 'imagem', 'audio')),
    conteudo TEXT,
    anexo_id BIGINT,
    mime_type VARCHAR(100),
    nome_arquivo VARCHAR(255),
    criada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_tb_chat_mensagem_anexo
        FOREIGN KEY (anexo_id) REFERENCES public.tb_chat_anexos(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_tb_chat_conversa
    ON public.tb_chat_mensagens (turma_id, educador_id, aluno_id, id);

CREATE INDEX IF NOT EXISTS idx_tb_chat_autor
    ON public.tb_chat_mensagens (autor_id, criada_em);

CREATE INDEX IF NOT EXISTS idx_tb_chat_anexo
    ON public.tb_chat_mensagens (anexo_id);
