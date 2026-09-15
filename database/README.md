# Banco de dados

- `postgresql/modelo-fisico-saas-veterinario.sql` — fonte da implementação (PostgreSQL 16+).
- `mysql/modelo-fisico-saas-veterinario.sql` — script histórico do MySQL Workbench.
- `modelo-fisico-saas-veterinario.sql` — cópia da versão PostgreSQL, para o caminho já citado na documentação.

O Flyway aplica a mesma estrutura em `backend/src/main/resources/db/migration/V1__modelo_fisico.sql`.
O conversor está em `scripts/convert-mysql-to-postgresql.mjs` e não altera regras de negócio: só a sintaxe do SGBD, mais a tabela autorizada `recuperacao_senha`.
