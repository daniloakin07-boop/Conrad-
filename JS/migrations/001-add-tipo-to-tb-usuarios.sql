-- ============================================================================
-- Arquivo   : JS/migrations/001-add-tipo-to-tb-usuarios.sql
-- Finalidade: acrescentar a coluna `tipo` (aluno | educador) à tabela de usuários.
-- Tabelas   : tb_usuarios
-- NOTA: esta migração usa sintaxe MySQL (AUTO_INCREMENT, ENGINE=InnoDB...) e pertence ao histórico
-- do projeto. O banco atual é PostgreSQL/Supabase: para criar um banco novo, use
-- JS/migrations/supabase-schema-corrigido.sql, que já contém todas as tabelas.
-- ============================================================================

ALTER TABLE tb_usuarios
ADD COLUMN tipo VARCHAR(20) NULL;