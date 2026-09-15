-- Catálogo global de redes da seção CONTATO. Sem inventar tabela: só seed de tipo_redesocial.

INSERT INTO flutz.tipo_redesocial (descricao)
VALUES
    ('Instagram'),
    ('Facebook'),
    ('TikTok'),
    ('YouTube'),
    ('WhatsApp'),
    ('X')
ON CONFLICT (descricao) DO NOTHING;
