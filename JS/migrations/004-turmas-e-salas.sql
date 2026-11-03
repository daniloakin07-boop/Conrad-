-- Execute este arquivo no banco de dados Conrad depois das migrations 001, 003 e 002.
-- Cria turmas reais, códigos de entrada, matrículas e uma sala de vídeo por turma.

CREATE TABLE IF NOT EXISTS tb_turmas (
    id INT NOT NULL AUTO_INCREMENT,
    nome VARCHAR(120) NOT NULL,
    disciplina VARCHAR(120) NOT NULL,
    secao VARCHAR(80) NULL,
    descricao VARCHAR(1000) NULL,
    codigo CHAR(8) NOT NULL,
    video_room VARCHAR(80) NOT NULL,
    professor_id INT NOT NULL,
    criada_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_tb_turmas_codigo (codigo),
    UNIQUE KEY uq_tb_turmas_video_room (video_room),
    INDEX idx_tb_turmas_professor (professor_id)
);

CREATE TABLE IF NOT EXISTS tb_turma_alunos (
    id INT NOT NULL AUTO_INCREMENT,
    turma_id INT NOT NULL,
    aluno_id INT NOT NULL,
    entrou_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_tb_turma_aluno (turma_id, aluno_id),
    INDEX idx_tb_turma_alunos_aluno (aluno_id),
    INDEX idx_tb_turma_alunos_turma (turma_id)
);

-- A coluna antiga `turma` continua preenchida para manter compatibilidade com registros existentes.
SET @schema_conrad = DATABASE();
SET @sql_conrad = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @schema_conrad
       AND TABLE_NAME = 'tb_atividades'
       AND COLUMN_NAME = 'turma_id') = 0,
    'ALTER TABLE tb_atividades ADD COLUMN turma_id INT NULL, ADD INDEX idx_tb_atividades_turma_id (turma_id)',
    'SELECT 1'
);
PREPARE stmt_conrad FROM @sql_conrad;
EXECUTE stmt_conrad;
DEALLOCATE PREPARE stmt_conrad;
