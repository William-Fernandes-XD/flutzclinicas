-- Catálogos operacionais passam a poder nascer na clínica (empresa_id).
-- NULL = item-base da plataforma (Cão, Gato, Consulta…), visível a todas.
-- Motivo de chat permanece só da plataforma (sem empresa_id).
-- Fotos de perfil do tutor e do pet.
-- Clínicas sem coordenada usam o centro de Brasília.

SET search_path TO flutz;

ALTER TABLE flutz.cliente
  ADD COLUMN IF NOT EXISTS foto_url VARCHAR(500) NULL;

ALTER TABLE flutz.pet
  ADD COLUMN IF NOT EXISTS foto_url VARCHAR(500) NULL;

COMMENT ON COLUMN flutz.cliente.foto_url IS
  'Foto de perfil do tutor.';

COMMENT ON COLUMN flutz.pet.foto_url IS
  'Foto de perfil do pet nesta clínica.';

ALTER TABLE flutz.pet_especie
  ADD COLUMN IF NOT EXISTS empresa_id INT NULL;

ALTER TABLE flutz.pet_raca
  ADD COLUMN IF NOT EXISTS empresa_id INT NULL;

ALTER TABLE flutz.tipo_servico
  ADD COLUMN IF NOT EXISTS empresa_id INT NULL;

ALTER TABLE flutz.especialidade
  ADD COLUMN IF NOT EXISTS empresa_id INT NULL;

ALTER TABLE flutz.doenca
  ADD COLUMN IF NOT EXISTS empresa_id INT NULL;

ALTER TABLE flutz.vacina
  ADD COLUMN IF NOT EXISTS empresa_id INT NULL;

ALTER TABLE flutz.pet_especie DROP CONSTRAINT IF EXISTS uk_pet_especie_descricao;
ALTER TABLE flutz.tipo_servico DROP CONSTRAINT IF EXISTS uk_tipo_servico_nome;
ALTER TABLE flutz.especialidade DROP CONSTRAINT IF EXISTS uk_especialidade_descricao;
ALTER TABLE flutz.doenca DROP CONSTRAINT IF EXISTS uk_doenca_nome;
ALTER TABLE flutz.vacina DROP CONSTRAINT IF EXISTS uk_vacina_nome;

ALTER TABLE flutz.pet_especie
  ADD CONSTRAINT uk_pet_especie_empresa_descricao UNIQUE (empresa_id, descricao);
ALTER TABLE flutz.tipo_servico
  ADD CONSTRAINT uk_tipo_servico_empresa_nome UNIQUE (empresa_id, tipo_servico);
ALTER TABLE flutz.especialidade
  ADD CONSTRAINT uk_especialidade_empresa_descricao UNIQUE (empresa_id, descricao);
ALTER TABLE flutz.doenca
  ADD CONSTRAINT uk_doenca_empresa_nome UNIQUE (empresa_id, nome_doenca);
ALTER TABLE flutz.vacina
  ADD CONSTRAINT uk_vacina_empresa_nome UNIQUE (empresa_id, nome_vacina);

ALTER TABLE flutz.pet_especie DROP CONSTRAINT IF EXISTS fk_pet_especie_empresa;
ALTER TABLE flutz.pet_especie
  ADD CONSTRAINT fk_pet_especie_empresa
    FOREIGN KEY (empresa_id) REFERENCES empresa (empresa_id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE flutz.pet_raca DROP CONSTRAINT IF EXISTS fk_pet_raca_empresa;
ALTER TABLE flutz.pet_raca
  ADD CONSTRAINT fk_pet_raca_empresa
    FOREIGN KEY (empresa_id) REFERENCES empresa (empresa_id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE flutz.tipo_servico DROP CONSTRAINT IF EXISTS fk_tipo_servico_empresa;
ALTER TABLE flutz.tipo_servico
  ADD CONSTRAINT fk_tipo_servico_empresa
    FOREIGN KEY (empresa_id) REFERENCES empresa (empresa_id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE flutz.especialidade DROP CONSTRAINT IF EXISTS fk_especialidade_empresa;
ALTER TABLE flutz.especialidade
  ADD CONSTRAINT fk_especialidade_empresa
    FOREIGN KEY (empresa_id) REFERENCES empresa (empresa_id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE flutz.doenca DROP CONSTRAINT IF EXISTS fk_doenca_empresa;
ALTER TABLE flutz.doenca
  ADD CONSTRAINT fk_doenca_empresa
    FOREIGN KEY (empresa_id) REFERENCES empresa (empresa_id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE flutz.vacina DROP CONSTRAINT IF EXISTS fk_vacina_empresa;
ALTER TABLE flutz.vacina
  ADD CONSTRAINT fk_vacina_empresa
    FOREIGN KEY (empresa_id) REFERENCES empresa (empresa_id) ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS idx_pet_especie_empresa ON flutz.pet_especie (empresa_id);
CREATE INDEX IF NOT EXISTS idx_pet_raca_empresa ON flutz.pet_raca (empresa_id);
CREATE INDEX IF NOT EXISTS idx_tipo_servico_empresa ON flutz.tipo_servico (empresa_id);
CREATE INDEX IF NOT EXISTS idx_especialidade_empresa ON flutz.especialidade (empresa_id);
CREATE INDEX IF NOT EXISTS idx_doenca_empresa ON flutz.doenca (empresa_id);
CREATE INDEX IF NOT EXISTS idx_vacina_empresa ON flutz.vacina (empresa_id);

COMMENT ON COLUMN flutz.pet_especie.empresa_id IS
  'NULL = catálogo-base da plataforma. Preenchido = cadastrado pela clínica.';

UPDATE flutz.empresa
SET latitude = -15.77972,
    longitude = -47.92972
WHERE latitude IS NULL OR longitude IS NULL;
