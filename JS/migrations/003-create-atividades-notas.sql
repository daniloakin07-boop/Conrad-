-- ============================================================================
-- Arquivo   : JS/migrations/003-create-atividades-notas.sql
-- Finalidade: criar as tabelas de atividades e de notas (base do boletim e das médias).
-- Tabelas   : tb_atividades, tb_notas
-- NOTA: esta migração usa sintaxe MySQL (AUTO_INCREMENT, ENGINE=InnoDB...) e pertence ao histórico
-- do projeto. O banco atual é PostgreSQL/Supabase: para criar um banco novo, use
-- JS/migrations/supabase-schema-corrigido.sql, que já contém todas as tabelas.
-- ============================================================================


-- Atividades cadastradas no CONRAD
CREATE TABLE IF NOT EXISTS tb_atividades (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    titulo VARCHAR(160) NOT NULL,
    turma VARCHAR(80) NOT NULL,
    disciplina VARCHAR(120) NOT NULL,
    data_aplicacao DATE NULL,
    valor_maximo DECIMAL(7,2) NOT NULL DEFAULT 10.00,
    descricao TEXT NULL,

    -- Só participa da média se os dois campos forem verdadeiros
    avaliativa TINYINT(1) NOT NULL DEFAULT 0,
    aplicada TINYINT(1) NOT NULL DEFAULT 0,

    criado_por INT NULL,
    criada_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_atividades_media (avaliativa, aplicada)
);

-- Notas lançadas para cada aluno em cada atividade
CREATE TABLE IF NOT EXISTS tb_notas (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    atividade_id INT NOT NULL,
    aluno_id INT NOT NULL,
    nota DECIMAL(7,2) NOT NULL,
    atualizada_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    -- Um aluno possui apenas uma nota por atividade
    UNIQUE KEY uq_atividade_aluno (atividade_id, aluno_id),
    INDEX idx_notas_aluno (aluno_id),

    CONSTRAINT fk_notas_atividade
        FOREIGN KEY (atividade_id)
        REFERENCES tb_atividades(id)
        ON DELETE CASCADE
);
