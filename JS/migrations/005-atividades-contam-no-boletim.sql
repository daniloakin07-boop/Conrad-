-- Execute no banco Conrad depois da migração 004.
-- As atividades e avaliações publicadas em turmas ficavam com avaliativa = 0 e aplicada = 0,
-- e o boletim/as médias só leem registros com os dois campos em 1. Isto corrige as já existentes.
-- (Dados novos já são gravados com os dois campos em 1 pela rota POST /api/atividades.)
UPDATE tb_atividades
   SET avaliativa = 1,
       aplicada = 1
 WHERE turma_id IS NOT NULL;
