-- Uma avaliação por tutor (cliente) em cada clínica.

-- Remove duplicatas mantendo a mais recente.
DELETE FROM flutz.avaliacao a
WHERE EXISTS (
  SELECT 1
  FROM flutz.avaliacao b
  WHERE b.empresa_id = a.empresa_id
    AND b.cliente_id = a.cliente_id
    AND b.avaliacao_id > a.avaliacao_id
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_avaliacao_empresa_cliente
  ON flutz.avaliacao (empresa_id, cliente_id);

COMMENT ON INDEX flutz.uk_avaliacao_empresa_cliente IS
  'Garante no máximo uma avaliação por tutor em cada clínica.';
