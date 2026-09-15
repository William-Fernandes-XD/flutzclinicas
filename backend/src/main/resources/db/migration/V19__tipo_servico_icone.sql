-- Ícone visual do tipo de serviço (consulta, vacinação, etc.).
ALTER TABLE flutz.tipo_servico
  ADD COLUMN IF NOT EXISTS icone VARCHAR(40);

COMMENT ON COLUMN flutz.tipo_servico.icone IS
  'Código do ícone visual do tipo (ex.: consulta, vacinacao, ultrassom).';

UPDATE flutz.tipo_servico SET icone = 'consulta'
WHERE icone IS NULL AND lower(tipo_servico) LIKE '%consulta%';

UPDATE flutz.tipo_servico SET icone = 'retorno'
WHERE icone IS NULL AND lower(tipo_servico) LIKE '%retorno%';

UPDATE flutz.tipo_servico SET icone = 'vacinacao'
WHERE icone IS NULL AND (lower(tipo_servico) LIKE '%vacin%' OR lower(tipo_servico) LIKE '%imuniz%');

UPDATE flutz.tipo_servico SET icone = 'cirurgia'
WHERE icone IS NULL AND (lower(tipo_servico) LIKE '%cirurg%' OR lower(tipo_servico) LIKE '%castra%');

UPDATE flutz.tipo_servico SET icone = 'emergencia'
WHERE icone IS NULL AND (lower(tipo_servico) LIKE '%emerg%' OR lower(tipo_servico) LIKE '%pronto%');

UPDATE flutz.tipo_servico SET icone = 'exame'
WHERE icone IS NULL AND (lower(tipo_servico) LIKE '%exame%' OR lower(tipo_servico) LIKE '%coleta%');

UPDATE flutz.tipo_servico SET icone = 'banho'
WHERE icone IS NULL AND (lower(tipo_servico) LIKE '%banho%' OR lower(tipo_servico) LIKE '%tosa%');

UPDATE flutz.tipo_servico SET icone = 'internacao'
WHERE icone IS NULL AND lower(tipo_servico) LIKE '%interna%';

UPDATE flutz.tipo_servico SET icone = 'ultrassom'
WHERE icone IS NULL AND lower(tipo_servico) LIKE '%ultras%';

UPDATE flutz.tipo_servico SET icone = 'raiox'
WHERE icone IS NULL AND (lower(tipo_servico) LIKE '%raio%' OR lower(tipo_servico) LIKE '%raio-x%' OR lower(tipo_servico) LIKE '%rx%');

UPDATE flutz.tipo_servico SET icone = 'checkup'
WHERE icone IS NULL AND (lower(tipo_servico) LIKE '%check%' OR lower(tipo_servico) LIKE '%check-up%');

UPDATE flutz.tipo_servico SET icone = 'microchip'
WHERE icone IS NULL AND lower(tipo_servico) LIKE '%microchip%';

UPDATE flutz.tipo_servico SET icone = 'curativo'
WHERE icone IS NULL AND (lower(tipo_servico) LIKE '%curativo%' OR lower(tipo_servico) LIKE '%medicamento%');

UPDATE flutz.tipo_servico SET icone = 'geral'
WHERE icone IS NULL;
