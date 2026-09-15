INSERT INTO flutz.empresa_vacina (empresa_id, vacina_id, status_id, visivel_agendamento)
SELECT v.empresa_id, v.vacina_id, s.status_id, TRUE
FROM flutz.vacina v
JOIN flutz.status s ON LOWER(s.descricao) = 'ativo'
WHERE v.empresa_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM flutz.empresa_vacina ev
    WHERE ev.empresa_id = v.empresa_id
      AND ev.vacina_id = v.vacina_id
  );
