-- Cliente provisório (walk-in da recepção): sem senha até o tutor completar o cadastro.

SET search_path TO flutz;

ALTER TABLE flutz.cliente
  ALTER COLUMN senha_hash DROP NOT NULL;

ALTER TABLE flutz.cliente
  ADD COLUMN IF NOT EXISTS cadastro_completo BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE flutz.cliente
  ADD COLUMN IF NOT EXISTS criado_por_empresa_id INT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_cliente_criado_por_empresa'
  ) THEN
    ALTER TABLE flutz.cliente
      ADD CONSTRAINT fk_cliente_criado_por_empresa
        FOREIGN KEY (criado_por_empresa_id)
        REFERENCES flutz.empresa (empresa_id)
        ON DELETE SET NULL
        ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_cliente_cadastro_completo_senha'
  ) THEN
    ALTER TABLE flutz.cliente
      ADD CONSTRAINT chk_cliente_cadastro_completo_senha
        CHECK (cadastro_completo = FALSE OR senha_hash IS NOT NULL);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cliente_cadastro_completo
  ON flutz.cliente (cadastro_completo)
  WHERE cadastro_completo = FALSE;

CREATE INDEX IF NOT EXISTS idx_cliente_criado_por_empresa
  ON flutz.cliente (criado_por_empresa_id);

COMMENT ON COLUMN flutz.cliente.senha_hash IS
  'Hash da senha. NULL enquanto cadastro_completo = FALSE (cliente provisório / walk-in).';

COMMENT ON COLUMN flutz.cliente.cadastro_completo IS
  'FALSE = tutor criado pela clínica sem conta (walk-in). TRUE = pode fazer login.';

COMMENT ON COLUMN flutz.cliente.criado_por_empresa_id IS
  'Clínica que criou o registro provisório (auditoria).';
