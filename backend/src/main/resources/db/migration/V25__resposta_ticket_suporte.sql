ALTER TABLE flutz.ticket_suporte
  ADD COLUMN IF NOT EXISTS resposta TEXT NULL,
  ADD COLUMN IF NOT EXISTS respondido_em TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS respondido_por INT NULL;

ALTER TABLE flutz.ticket_suporte
  DROP CONSTRAINT IF EXISTS fk_ticket_suporte_respondido_por;

ALTER TABLE flutz.ticket_suporte
  ADD CONSTRAINT fk_ticket_suporte_respondido_por
    FOREIGN KEY (respondido_por)
    REFERENCES flutz.administrador_sistema (administrador_sistema_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

ALTER TABLE flutz.notificacao
  DROP CONSTRAINT IF EXISTS chk_notificacao_tipo;

ALTER TABLE flutz.notificacao
  ADD CONSTRAINT chk_notificacao_tipo CHECK (tipo IN (
    'CHAT_MENSAGEM',
    'VACINA_D3',
    'VACINA_D1',
    'AGENDA_CONFIRMADA',
    'AGENDA_CANCELADA',
    'AGENDA_RECUSADA',
    'AGENDA_SOLICITACAO',
    'AGENDA_PROPOSTA',
    'AGENDA_PAGAMENTO',
    'ATENDIMENTO_D1',
    'ATENDIMENTO_H1',
    'TICKET_SUPORTE',
    'TICKET_RESPOSTA',
    'ASSINATURA_D3'
  ));
