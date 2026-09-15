-- Catálogos iniciais. Schema: flutz. Reexecução segura (ON CONFLICT DO NOTHING).
-- Limites de plano ficam NULL (ilimitado) até existir regra comercial aprovada.
-- Flags permite_doacoes / permite_pagamentos do Básico vs demais são proposta
-- comercial inicial alinhada à landing; podem ser ajustadas sem mudar o modelo.

INSERT INTO flutz.status (descricao)
VALUES
    ('ativo'),
    ('inativo'),
    ('pendente'),
    ('bloqueado'),
    ('inadimplente')
ON CONFLICT (descricao) DO NOTHING;

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
VALUES
    ('BASICO', 'Básico', 'Plano inicial da clínica.', 99.90, 'BRL', NULL, NULL, TRUE, FALSE, FALSE, TRUE),
    ('PROFISSIONAL', 'Profissional', 'Plano intermediário da clínica.', 199.90, 'BRL', NULL, NULL, TRUE, TRUE, TRUE, TRUE),
    ('PREMIUM', 'Premium', 'Plano completo da clínica.', 299.90, 'BRL', NULL, NULL, TRUE, TRUE, TRUE, TRUE)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO flutz.imagem_posicao (posicao)
VALUES
    ('centro'),
    ('topo'),
    ('baixo'),
    ('esquerda'),
    ('direita')
ON CONFLICT (posicao) DO NOTHING;

INSERT INTO flutz.agendamento_status (codigo, descricao)
VALUES
    ('SOLICITADO', 'Solicitado'),
    ('CONFIRMADO', 'Confirmado'),
    ('CANCELADO', 'Cancelado'),
    ('FALTOU', 'Faltou')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO flutz.atendimento_status (descricao)
VALUES
    ('aguardando'),
    ('em andamento'),
    ('concluido'),
    ('cancelado')
ON CONFLICT (descricao) DO NOTHING;

INSERT INTO flutz.role (descricao)
VALUES
    ('administrador'),
    ('veterinario'),
    ('recepcao')
ON CONFLICT (descricao) DO NOTHING;
