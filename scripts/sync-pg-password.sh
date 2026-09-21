#!/bin/sh
# Sincroniza a senha do role postgres com POSTGRES_PASSWORD do container.
# Usa variável do psql (:'pw') para não quebrar com caracteres como #.
psql -U postgres -v ON_ERROR_STOP=1 -v pw="$POSTGRES_PASSWORD" <<'SQL'
ALTER USER postgres WITH PASSWORD :'pw';
SQL
