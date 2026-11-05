-- Anexos binários ficam separados das mensagens para não carregar todas as imagens
-- e gravações ao abrir o histórico da conversa.
CREATE TABLE IF NOT EXISTS tb_chat_anexos (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    turma_id BIGINT UNSIGNED NOT NULL,
    educador_id BIGINT UNSIGNED NOT NULL,
    aluno_id BIGINT UNSIGNED NOT NULL,
    autor_id BIGINT UNSIGNED NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    nome_arquivo VARCHAR(255) NULL,
    tamanho_bytes INT UNSIGNED NOT NULL,
    conteudo LONGBLOB NOT NULL,
    criada_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_chat_anexo_participantes (turma_id, educador_id, aluno_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- O histórico guarda apenas o texto ou o ID do anexo, não o arquivo binário.
CREATE TABLE IF NOT EXISTS tb_chat_mensagens (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    turma_id BIGINT UNSIGNED NOT NULL,
    educador_id BIGINT UNSIGNED NOT NULL,
    aluno_id BIGINT UNSIGNED NOT NULL,
    autor_id BIGINT UNSIGNED NOT NULL,
    autor_nome VARCHAR(150) NOT NULL,
    tipo ENUM('texto', 'imagem', 'audio') NOT NULL DEFAULT 'texto',
    conteudo TEXT NULL,
    anexo_id BIGINT UNSIGNED NULL,
    mime_type VARCHAR(100) NULL,
    nome_arquivo VARCHAR(255) NULL,
    criada_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_chat_conversa (turma_id, educador_id, aluno_id, id),
    KEY idx_chat_autor (autor_id, criada_em),
    KEY idx_chat_anexo (anexo_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
