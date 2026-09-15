-- Chat: permite mensagens automáticas do sistema (abertura por agendamento).

ALTER TABLE flutz.chat_mensagem
  DROP CONSTRAINT IF EXISTS chk_chat_mensagem_remetente;

ALTER TABLE flutz.chat_mensagem
  ADD CONSTRAINT chk_chat_mensagem_remetente
  CHECK (remetente_tipo IN ('CLIENTE', 'COLABORADOR', 'SISTEMA'));

ALTER TABLE flutz.chat_mensagem
  ALTER COLUMN remetente_id DROP NOT NULL;

COMMENT ON COLUMN flutz.chat_mensagem.remetente_tipo IS
  'CLIENTE = tutor; COLABORADOR = equipe da clínica; SISTEMA = aviso automático (ex.: abertura por agendamento).';
