-- Execute no banco Conrad depois da migracao 004 e antes da 005.
-- Bancos antigos podem ter tb_atividades sem as colunas usadas no boletim.

SET @schema_conrad = DATABASE();

SET @sql_conrad = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @schema_conrad
       AND TABLE_NAME = 'tb_atividades'
       AND COLUMN_NAME = 'avaliativa') = 0,
    'ALTER TABLE tb_atividades ADD COLUMN avaliativa TINYINT(1) NOT NULL DEFAULT 0',
    'SELECT 1'
);
PREPARE stmt_conrad FROM @sql_conrad;
EXECUTE stmt_conrad;
DEALLOCATE PREPARE stmt_conrad;

SET @sql_conrad = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @schema_conrad
       AND TABLE_NAME = 'tb_atividades'
       AND COLUMN_NAME = 'aplicada') = 0,
    'ALTER TABLE tb_atividades ADD COLUMN aplicada TINYINT(1) NOT NULL DEFAULT 0',
    'SELECT 1'
);
PREPARE stmt_conrad FROM @sql_conrad;
EXECUTE stmt_conrad;
DEALLOCATE PREPARE stmt_conrad;
