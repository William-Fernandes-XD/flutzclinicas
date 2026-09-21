-- PKCE: guarda code_verifier junto do state OAuth.

SET search_path TO flutz;

ALTER TABLE flutz.mercadopago_oauth_state
  ADD COLUMN IF NOT EXISTS code_verifier VARCHAR(128) NULL;

COMMENT ON COLUMN flutz.mercadopago_oauth_state.code_verifier IS
  'PKCE code_verifier. Usado na troca do authorization code por tokens.';
