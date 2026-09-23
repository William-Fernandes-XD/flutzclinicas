-- Tokens OAuth do Mercado Pago ultrapassam VARCHAR(255).

SET search_path TO flutz;

ALTER TABLE flutz.conta_pagamento
  ALTER COLUMN access_token TYPE TEXT,
  ALTER COLUMN refresh_token TYPE TEXT,
  ALTER COLUMN public_key TYPE TEXT,
  ALTER COLUMN oauth_scope TYPE TEXT;

ALTER TABLE flutz.conta_pagamento
  ALTER COLUMN nome_exibicao TYPE VARCHAR(255);

COMMENT ON COLUMN flutz.conta_pagamento.access_token IS
  'Access token OAuth/manual da clínica (pode ser longo).';
COMMENT ON COLUMN flutz.conta_pagamento.refresh_token IS
  'Refresh token OAuth da clínica.';
COMMENT ON COLUMN flutz.conta_pagamento.public_key IS
  'Public key do vendedor (Bricks) ou fallback da plataforma.';
COMMENT ON COLUMN flutz.conta_pagamento.oauth_scope IS
  'Scopes concedidos no Connect (offline_access, read, write, …).';
