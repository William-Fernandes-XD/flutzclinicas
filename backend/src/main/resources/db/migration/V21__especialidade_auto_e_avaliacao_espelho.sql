-- Especialidades do catálogo da clínica passam a valer automaticamente na oferta da página.
INSERT INTO flutz.empresa_especialidade (empresa_id, especialidade_id, ordem, visivel_pagina, status_id)
SELECT e.empresa_id,
       e.especialidade_id,
       COALESCE((
         SELECT MAX(ee.ordem) FROM flutz.empresa_especialidade ee WHERE ee.empresa_id = e.empresa_id
       ), 0) + ROW_NUMBER() OVER (PARTITION BY e.empresa_id ORDER BY e.descricao),
       TRUE,
       s.status_id
FROM flutz.especialidade e
JOIN flutz.status s ON LOWER(s.descricao) = 'ativo'
WHERE e.empresa_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM flutz.empresa_especialidade ee
    WHERE ee.empresa_id = e.empresa_id
      AND ee.especialidade_id = e.especialidade_id
  );

-- Espelha avaliações de serviço (tutor) na tabela usada pela gestão/página pública.
INSERT INTO flutz.avaliacao_cliente (
  empresa_id, cliente_id, pet_id, nome_cliente, nome_pet, texto, nota,
  visivel, autorizado_publicacao, data_autorizacao, status_id, data_avaliacao
)
SELECT a.empresa_id,
       a.cliente_id,
       COALESCE(at.pet_id, h.pet_id),
       c.nome_cliente,
       p.nome_pet,
       COALESCE(NULLIF(TRIM(a.comentario), ''), 'Avaliação sem comentário.'),
       a.nota,
       TRUE,
       TRUE,
       a.data_criacao,
       s.status_id,
       a.data_criacao
FROM flutz.avaliacao a
JOIN flutz.cliente c ON c.cliente_id = a.cliente_id
JOIN flutz.status s ON LOWER(s.descricao) = 'ativo'
LEFT JOIN flutz.atendimento at ON at.atendimento_id = a.atendimento_id
LEFT JOIN flutz.historico_vacinacao h ON h.historico_vacinacao_id = a.historico_vacinacao_id
LEFT JOIN flutz.pet p ON p.pet_id = COALESCE(at.pet_id, h.pet_id)
WHERE NOT EXISTS (
  SELECT 1
  FROM flutz.avaliacao_cliente ac
  WHERE ac.empresa_id = a.empresa_id
    AND ac.cliente_id = a.cliente_id
    AND ac.data_avaliacao = a.data_criacao
);
