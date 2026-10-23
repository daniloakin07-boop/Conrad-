-- Execute no banco Conrad depois da migracao 001.
-- Este script adiciona as colunas usadas pelo fluxo e cria a tabela de entregas.

SET @schema_conrad = DATABASE();

SET @sql_conrad = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @schema_conrad
       AND TABLE_NAME = 'tb_usuarios'
       AND COLUMN_NAME = 'turma') = 0,
    'ALTER TABLE tb_usuarios ADD COLUMN turma VARCHAR(80) NULL',
    'SELECT 1'
);
PREPARE stmt_conrad FROM @sql_conrad;
EXECUTE stmt_conrad;
DEALLOCATE PREPARE stmt_conrad;

SET @sql_conrad = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @schema_conrad
       AND TABLE_NAME = 'tb_atividades'
       AND COLUMN_NAME = 'descricao') = 0,
    'ALTER TABLE tb_atividades ADD COLUMN descricao TEXT NULL',
    'SELECT 1'
);
PREPARE stmt_conrad FROM @sql_conrad;
EXECUTE stmt_conrad;
DEALLOCATE PREPARE stmt_conrad;

SET @sql_conrad = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @schema_conrad
       AND TABLE_NAME = 'tb_atividades'
       AND COLUMN_NAME = 'tipo') = 0,
    'ALTER TABLE tb_atividades ADD COLUMN tipo VARCHAR(20) NOT NULL DEFAULT ''atividade''',
    'SELECT 1'
);
PREPARE stmt_conrad FROM @sql_conrad;
EXECUTE stmt_conrad;
DEALLOCATE PREPARE stmt_conrad;

SET @sql_conrad = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @schema_conrad
       AND TABLE_NAME = 'tb_atividades'
       AND COLUMN_NAME = 'criado_por') = 0,
    'ALTER TABLE tb_atividades ADD COLUMN criado_por BIGINT NULL',
    'SELECT 1'
);
PREPARE stmt_conrad FROM @sql_conrad;
EXECUTE stmt_conrad;
DEALLOCATE PREPARE stmt_conrad;

SET @sql_conrad = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @schema_conrad
       AND TABLE_NAME = 'tb_atividades'
       AND COLUMN_NAME = 'criada_em') = 0,
    'ALTER TABLE tb_atividades ADD COLUMN criada_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
    'SELECT 1'
);
PREPARE stmt_conrad FROM @sql_conrad;
EXECUTE stmt_conrad;
DEALLOCATE PREPARE stmt_conrad;

CREATE TABLE IF NOT EXISTS tb_entregas (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    atividade_id BIGINT UNSIGNED NOT NULL,
    aluno_id BIGINT UNSIGNED NOT NULL,
    resposta TEXT NOT NULL,
    enviada_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    feedback TEXT NULL,
    corrigida_em DATETIME NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_tb_entregas_atividade_aluno (atividade_id, aluno_id)
);

-- A correcao atualiza a nota de uma atividade/aluno; esse par precisa ser unico.
-- Se houver notas duplicadas existentes, o ALTER falhara sem apagar dados;
-- revise-as antes de executar a migracao novamente.
SET @sql_conrad = IF(
    (SELECT COUNT(*) FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = @schema_conrad
       AND TABLE_NAME = 'tb_notas'
       AND INDEX_NAME = 'uq_tb_notas_atividade_aluno') = 0,
    'ALTER TABLE tb_notas ADD UNIQUE KEY uq_tb_notas_atividade_aluno (atividade_id, aluno_id)',
    'SELECT 1'
);
PREPARE stmt_conrad FROM @sql_conrad;
EXECUTE stmt_conrad;
DEALLOCATE PREPARE stmt_conrad;
