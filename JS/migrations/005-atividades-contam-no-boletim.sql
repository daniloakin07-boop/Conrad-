-- ============================================================================
-- Arquivo   : JS/migrations/005-atividades-contam-no-boletim.sql
-- Finalidade: corrigir atividades já publicadas em turmas para que entrem no boletim e nas médias (avaliativa/aplicada = 1).
-- Tabelas   : tb_atividades
-- NOTA: esta migração usa sintaxe MySQL (AUTO_INCREMENT, ENGINE=InnoDB...) e pertence ao histórico
-- do projeto. O banco atual é PostgreSQL/Supabase: para criar um banco novo, use
-- JS/migrations/supabase-schema-corrigido.sql, que já contém todas as tabelas.
-- ============================================================================

-- Execute no banco Conrad depois das migrações 004 e 006.
-- As atividades e avaliações publicadas em turmas ficavam com avaliativa = 0 e aplicada = 0,
-- e o boletim/as médias só leem registros com os dois campos em 1. Isto corrige as já existentes.
-- (Dados novos já são gravados com os dois campos em 1 pela rota POST /api/atividades.)
UPDATE tb_atividades
   SET avaliativa = 1,
       aplicada = 1
 WHERE turma_id IS NOT NULL;
