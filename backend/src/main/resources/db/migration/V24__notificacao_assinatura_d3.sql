-- Lembrete de assinatura (D-3) + tipo de notificação.

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
    'ASSINATURA_D3'
  ));
