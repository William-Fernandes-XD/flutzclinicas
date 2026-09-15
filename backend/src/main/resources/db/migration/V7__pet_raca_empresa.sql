-- Raça também pode nascer na clínica; o unique antigo era só (espécie, nome) no SaaS inteiro.

SET search_path TO flutz;

ALTER TABLE flutz.pet_raca DROP CONSTRAINT IF EXISTS uk_pet_raca_especie_descricao;

ALTER TABLE flutz.pet_raca DROP CONSTRAINT IF EXISTS uk_pet_raca_empresa_especie_descricao;
ALTER TABLE flutz.pet_raca
  ADD CONSTRAINT uk_pet_raca_empresa_especie_descricao UNIQUE (empresa_id, pet_especie_id, descricao);
