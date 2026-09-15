-- Plano único mensal Flutz (R$ 149,90). Desativa Básico / Profissional / Premium.

INSERT INTO flutz.plano (
    codigo,
    nome,
    descricao,
    valor_mensal,
    moeda,
    limite_colaboradores,
    limite_clientes,
    permite_pagina_publica,
    permite_doacoes,
    permite_pagamentos,
    ativo
)
VALUES (
    'FLUTZ',
    'Flutz',
    'Assinatura mensal da plataforma: gestão da clínica e acesso dos funcionários cadastrados.',
    149.90,
    'BRL',
    NULL,
    NULL,
    TRUE,
    TRUE,
    TRUE,
    TRUE
)
ON CONFLICT (codigo) DO UPDATE
SET nome = EXCLUDED.nome,
    descricao = EXCLUDED.descricao,
    valor_mensal = EXCLUDED.valor_mensal,
    moeda = EXCLUDED.moeda,
    permite_pagina_publica = TRUE,
    permite_doacoes = TRUE,
    permite_pagamentos = TRUE,
    ativo = TRUE;

UPDATE flutz.assinatura
SET plano_id = (SELECT plano_id FROM flutz.plano WHERE codigo = 'FLUTZ')
WHERE plano_id IN (
    SELECT plano_id FROM flutz.plano WHERE codigo IN ('BASICO', 'PROFISSIONAL', 'PREMIUM')
);

UPDATE flutz.plano
SET ativo = FALSE
WHERE codigo IN ('BASICO', 'PROFISSIONAL', 'PREMIUM');

UPDATE flutz.fatura_assinatura f
SET valor_bruto = 149.90,
    valor = CASE
              WHEN COALESCE(f.percentual_desconto_aplicado, 0) > 0
                THEN ROUND(149.90 * (1 - (f.percentual_desconto_aplicado / 100.0)), 2)
              ELSE 149.90
            END
WHERE f.status_fatura IN ('PENDENTE', 'ATRASADA');
