-- Guarda o redirect_uri usado no authorize para o token exchange usar o mesmo valor.

SET search_path TO flutz;

ALTER TABLE flutz.mercadopago_oauth_state
  ADD COLUMN IF NOT EXISTS redirect_uri VARCHAR(500) NULL;

COMMENT ON COLUMN flutz.mercadopago_oauth_state.redirect_uri IS
  'redirect_uri exato enviado ao authorize; obrigatório no POST /oauth/token.';
