-- Permite vários serviços oferecidos a partir do mesmo tipo (ex.: Castração macho/fêmea),
-- inclusive com o mesmo ícone. O bloqueio antigo era por tipo, não por ícone.
ALTER TABLE flutz.empresa_servico
  DROP CONSTRAINT IF EXISTS uk_empresa_servico;

-- Evita duplicar o mesmo nome de exibição para o mesmo tipo na clínica
CREATE UNIQUE INDEX IF NOT EXISTS uk_empresa_servico_tipo_nome
  ON flutz.empresa_servico (
    empresa_id,
    tipo_servico_id,
    lower(coalesce(nullif(btrim(nome_exibicao), ''), ''))
  );

COMMENT ON INDEX flutz.uk_empresa_servico_tipo_nome IS
  'Na mesma clínica, o mesmo tipo não pode ter duas ofertas com o mesmo nome de exibição.';
