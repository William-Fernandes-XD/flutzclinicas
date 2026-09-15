-- Estado compartilhado do bloqueio de login (3 réplicas).
-- Catálogos mínimos para pets e serviços da clínica.

CREATE TABLE IF NOT EXISTS flutz.tentativa_login (
    chave VARCHAR(255) NOT NULL,
    falhas INTEGER NOT NULL DEFAULT 0,
    bloqueado_ate TIMESTAMP NULL,
    ultima_falha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_tentativa_login PRIMARY KEY (chave)
);

INSERT INTO flutz.tipo_servico (tipo_servico)
VALUES
    ('Consulta'),
    ('Vacinação'),
    ('Retorno'),
    ('Cirurgia'),
    ('Emergência')
ON CONFLICT (tipo_servico) DO NOTHING;

INSERT INTO flutz.pet_especie (descricao)
VALUES
    ('Cão'),
    ('Gato'),
    ('Ave'),
    ('Outro')
ON CONFLICT (descricao) DO NOTHING;

INSERT INTO flutz.pet_raca (descricao, pet_especie_id)
SELECT 'SRD', e.pet_especie_id
FROM flutz.pet_especie e
WHERE e.descricao IN ('Cão', 'Gato', 'Ave', 'Outro')
ON CONFLICT (pet_especie_id, descricao) DO NOTHING;
