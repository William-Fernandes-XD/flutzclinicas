-- Ícone visual e desativação suave para espécies do catálogo.
ALTER TABLE flutz.pet_especie
  ADD COLUMN IF NOT EXISTS icone VARCHAR(40),
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN flutz.pet_especie.icone IS
  'Código do ícone visual (ex.: cao, gato, tartaruga). NULL = genérico.';
COMMENT ON COLUMN flutz.pet_especie.ativo IS
  'FALSE = oculto em novos cadastros; mantém histórico e FKs.';

UPDATE flutz.pet_especie SET icone = 'cao'
WHERE icone IS NULL AND lower(descricao) IN ('cão', 'cao', 'cachorro', 'canino');

UPDATE flutz.pet_especie SET icone = 'gato'
WHERE icone IS NULL AND lower(descricao) IN ('gato', 'felino', 'gata');

UPDATE flutz.pet_especie SET icone = 'ave'
WHERE icone IS NULL AND (
  lower(descricao) LIKE '%ave%'
  OR lower(descricao) LIKE '%páss%'
  OR lower(descricao) LIKE '%pass%'
  OR lower(descricao) IN ('pássaro', 'passaro')
);

UPDATE flutz.pet_especie SET icone = 'outro'
WHERE icone IS NULL AND lower(descricao) IN ('outro', 'outros', 'diversos');

CREATE INDEX IF NOT EXISTS idx_pet_especie_ativo
  ON flutz.pet_especie (ativo)
  WHERE ativo = TRUE;
