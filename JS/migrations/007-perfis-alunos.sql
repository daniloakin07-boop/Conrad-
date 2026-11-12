-- Dados complementares apresentados no perfil do estudante.
-- O servidor também cria esta tabela automaticamente quando o perfil é aberto.
CREATE TABLE IF NOT EXISTS tb_perfis_alunos (
    usuario_id BIGINT UNSIGNED NOT NULL,
    sobre_mim VARCHAR(800) NULL,
    interesses TEXT NULL,
    habilidades TEXT NULL,
    foto_perfil MEDIUMTEXT NULL,
    atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
