-- Vacinas passam a ser catálogo da plataforma (empresa_id NULL).
-- Clínicas apenas oferecem via empresa_vacina.

-- 1) Promove vacinas da clínica para o catálogo global quando o nome ainda não existe na plataforma.
UPDATE flutz.vacina v
SET empresa_id = NULL
WHERE v.empresa_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM flutz.vacina g
    WHERE g.empresa_id IS NULL
      AND LOWER(TRIM(g.nome_vacina)) = LOWER(TRIM(v.nome_vacina))
  );

-- 2) Quando já existe global com o mesmo nome, remapeia ofertas e histórico para a global e remove a duplicata da clínica.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT v.vacina_id AS clinic_id, g.vacina_id AS global_id
    FROM flutz.vacina v
    JOIN flutz.vacina g
      ON g.empresa_id IS NULL
     AND LOWER(TRIM(g.nome_vacina)) = LOWER(TRIM(v.nome_vacina))
    WHERE v.empresa_id IS NOT NULL
  LOOP
    UPDATE flutz.empresa_vacina ev
    SET vacina_id = r.global_id
    WHERE ev.vacina_id = r.clinic_id
      AND NOT EXISTS (
        SELECT 1 FROM flutz.empresa_vacina x
        WHERE x.empresa_id = ev.empresa_id AND x.vacina_id = r.global_id
      );

    DELETE FROM flutz.empresa_vacina WHERE vacina_id = r.clinic_id;

    UPDATE flutz.historico_vacinacao SET vacina_id = r.global_id WHERE vacina_id = r.clinic_id;

    DELETE FROM flutz.vacina_doenca vd
    WHERE vd.vacina_id = r.clinic_id
      AND EXISTS (
        SELECT 1 FROM flutz.vacina_doenca x
        WHERE x.vacina_id = r.global_id AND x.doenca_id = vd.doenca_id
      );

    UPDATE flutz.vacina_doenca SET vacina_id = r.global_id WHERE vacina_id = r.clinic_id;

    DELETE FROM flutz.vacina WHERE vacina_id = r.clinic_id;
  END LOOP;
END $$;

-- 3) Semente de vacinas veterinárias comunsas (protocolo BR / CFMV-orientado). Sem API pública gratuita confiável.
INSERT INTO flutz.vacina (nome_vacina, descricao, fabricante, empresa_id)
SELECT s.nome, s.descricao, s.fabricante, NULL
FROM (
  VALUES
    ('V8 (Óctupla canina)', 'Proteção múltipla canina clássica (cinomose, parvovirose, hepatite, adenovírus, parainfluenza, leptospirose).', 'Catálogo Flutz'),
    ('V10 (Décupla canina)', 'Vacina múltipla canina ampliada, incluindo variantes de leptospira.', 'Catálogo Flutz'),
    ('Antirrábica canina', 'Raiva — obrigatória em muitos municípios brasileiros.', 'Catálogo Flutz'),
    ('Gripe canina (Bordetella / Influenza)', 'Tosse dos canis / influenza canina.', 'Catálogo Flutz'),
    ('Giárdia (canina)', 'Prevenção de giardíase em cães.', 'Catálogo Flutz'),
    ('Leishmaniose canina', 'Vacina contra leishmaniose visceral canina (quando indicada).', 'Catálogo Flutz'),
    ('Leptospirose (reforço)', 'Reforço específico de leptospira.', 'Catálogo Flutz'),
    ('Cinomose (monovalente)', 'Proteção específica contra cinomose.', 'Catálogo Flutz'),
    ('Parvovirose (monovalente)', 'Proteção específica contra parvovírus canino.', 'Catálogo Flutz'),
    ('V3 / V4 felina', 'Panleucopenia, calicivírus e rinotraqueíte (herpesvírus); V4 pode incluir clamídia.', 'Catálogo Flutz'),
    ('V5 felina', 'Múltipla felina ampliada (conforme protocolo da clínica).', 'Catálogo Flutz'),
    ('Antirrábica felina', 'Raiva em felinos.', 'Catálogo Flutz'),
    ('FeLV (Leucemia felina)', 'Prevenção da leucemia felina.', 'Catálogo Flutz'),
    ('FIV (Imunodeficiência felina)', 'Quando disponível/indicada no protocolo local.', 'Catálogo Flutz'),
    ('Clamidiose felina', 'Clamídia felina (quando não incluída na múltipla).', 'Catálogo Flutz'),
    ('Peritonite infecciosa felina (PIF)', 'Quando disponível e indicada.', 'Catálogo Flutz'),
    ('Mixomatose (coelho)', 'Mixomatose em lagomorfos.', 'Catálogo Flutz'),
    ('Doença hemorrágica viral (RHD) — coelho', 'RHD/VHD em coelhos.', 'Catálogo Flutz'),
    ('Vacina polivalente furão', 'Protocolo básico para mustelídeos (conforme marca).', 'Catálogo Flutz'),
    ('Vacina equina antirrábica', 'Raiva em equinos.', 'Catálogo Flutz'),
    ('Encefalomielite equina', 'Encefalomielites equinas (EEL/EOE).', 'Catálogo Flutz'),
    ('Tétano equino', 'Toxóide tetânico equino.', 'Catálogo Flutz'),
    ('Influenza equina', 'Gripe equina.', 'Catálogo Flutz'),
    ('Vacina polivalente aves', 'Protocolos aviários comuns (conforme espécie).', 'Catálogo Flutz'),
    ('Vacina suína básica', 'Protocolos suínos comuns (conforme finalidade).', 'Catálogo Flutz')
) AS s(nome, descricao, fabricante)
WHERE NOT EXISTS (
  SELECT 1 FROM flutz.vacina v
  WHERE v.empresa_id IS NULL
    AND LOWER(TRIM(v.nome_vacina)) = LOWER(TRIM(s.nome))
);

COMMENT ON TABLE flutz.vacina IS
  'Catálogo global de vacinas da plataforma Flutz. Clínicas oferecem via empresa_vacina.';
