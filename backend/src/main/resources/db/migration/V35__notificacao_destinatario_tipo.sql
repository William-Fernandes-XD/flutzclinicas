-- destinatario_tipo 'ADMINISTRADOR_SISTEMA' tem 21 caracteres e estourava VARCHAR(20),
-- abortando o POST /api/suporte.

ALTER TABLE flutz.notificacao
  ALTER COLUMN destinatario_tipo TYPE VARCHAR(40);
