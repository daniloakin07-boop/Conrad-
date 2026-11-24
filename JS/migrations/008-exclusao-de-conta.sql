-- ============================================================================
-- Arquivo   : JS/migrations/008-exclusao-de-conta.sql
-- Finalidade: permitir que um EDUCADOR exclua a própria conta SEM apagar o histórico dos alunos.
-- Tabelas   : tb_turmas (professor_id), tb_atividades (criado_por)
-- Banco     : PostgreSQL/Supabase. Execute no "SQL Editor" do Supabase. É seguro repetir (idempotente).
--
-- POR QUÊ:
--   Em supabase-schema.sql, tb_turmas.professor_id era NOT NULL com ON DELETE CASCADE.
--   Excluir o educador apagaria TODAS as suas turmas e, em cascata, as matrículas dos alunos;
--   as atividades ficariam sem turma (turma_id = NULL) e o histórico dos estudantes seria
--   prejudicado. Esta migração troca esse comportamento por uma política que preserva os dados.
--
-- POLÍTICA ADOTADA (aplicada por JS/exclusao-conta.js):
--   * A turma continua existindo, com professor_id = NULL ("turma sem educador"): matrículas,
--     atividades, entregas, notas e boletim dos alunos são preservados.
--   * tb_atividades.criado_por passa a NULL (já era ON DELETE SET NULL): ninguém consegue
--     editar/excluir essas atividades, mas os alunos continuam vendo notas e feedback.
--   * Turmas sem educador não aceitam novos alunos nem novas entregas (regras no servidor).
--   * Dados do ALUNO excluído (perfil, matrículas, entregas, respostas, notas) são removidos.
--   * Bate-papo: anexos do usuário excluído são apagados e suas mensagens são anonimizadas.
-- ============================================================================

BEGIN;

-- 1) A turma pode ficar temporariamente sem educador.
ALTER TABLE public.tb_turmas
    ALTER COLUMN professor_id DROP NOT NULL;

-- 2) Troca CASCADE por SET NULL na chave estrangeira do educador.
ALTER TABLE public.tb_turmas
    DROP CONSTRAINT IF EXISTS fk_tb_turmas_professor;

ALTER TABLE public.tb_turmas
    ADD CONSTRAINT fk_tb_turmas_professor
    FOREIGN KEY (professor_id) REFERENCES public.tb_usuarios(id) ON DELETE SET NULL;

-- 3) Garante o comportamento SET NULL também em criado_por (bancos criados fora do esquema atual).
ALTER TABLE public.tb_atividades
    DROP CONSTRAINT IF EXISTS fk_tb_atividades_criador;

ALTER TABLE public.tb_atividades
    ADD CONSTRAINT fk_tb_atividades_criador
    FOREIGN KEY (criado_por) REFERENCES public.tb_usuarios(id) ON DELETE SET NULL;

COMMIT;

-- Reversão (somente se NÃO existirem turmas com professor_id nulo):
--   ALTER TABLE public.tb_turmas ALTER COLUMN professor_id SET NOT NULL;
--   (e recriar fk_tb_turmas_professor com ON DELETE CASCADE)
