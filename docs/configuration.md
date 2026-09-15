# Configuração por ambiente

Todos os parâmetros configuráveis do Flutz entram por variável de ambiente. O `.env` local não deve ser commitado. Use `.env.example` como modelo.

| Variável | Obrigatória | Sensível | Descrição |
| --- | --- | --- | --- |
| `APP_NAME` | Sim | Não | Nome do produto |
| `APP_ENV` | Sim | Não | `development`, `test` ou `production` |
| `APP_URL` | Sim | Não | URL pública da API |
| `FRONTEND_URL` | Sim | Não | URL do frontend (links de e-mail, redirects) |
| `COMPANY_NAME` | Não | Não | Empresa responsável (UpVibe) |
| `COMPANY_URL` | Não | Não | Site da empresa responsável |
| `SERVER_PORT` | Não | Não | Porta HTTP do backend (padrão 8080) |
| `VITE_API_URL` | Sim (frontend) | Não | URL da API usada pelo navegador |
| `VITE_SITE_URL` | Não | Não | URL canônica do site (SEO) |
| `VITE_APP_NAME` | Não | Não | Nome exibido no frontend |
| `VITE_COMPANY_NAME` | Não | Não | Nome da empresa no rodapé |
| `VITE_COMPANY_URL` | Não | Não | Link do rodapé |
| `VITE_CONTACT_EMAIL` | Não | Não | E-mail público do rodapé |
| `VITE_CONTACT_WHATSAPP` | Não | Não | WhatsApp público do rodapé (somente dígitos) |
| `VITE_INSTAGRAM_URL` | Não | Não | URL do Instagram público do rodapé |
| `VITE_PLANO_BASICO` | Não | Não | Preço de **apresentação** do plano Básico |
| `VITE_PLANO_PROFISSIONAL` | Não | Não | Preço de **apresentação** do plano Profissional |
| `VITE_PLANO_PREMIUM` | Não | Não | Preço de **apresentação** do plano Premium |
| `DATABASE_HOST` | Sim | Não | Host PostgreSQL |
| `DATABASE_PORT` | Não | Não | Porta PostgreSQL (padrão 5432) |
| `DATABASE_NAME` | Sim | Não | Nome do banco |
| `DATABASE_USERNAME` | Sim em produção | Sim | Usuário do banco |
| `DATABASE_PASSWORD` | Sim em produção | Sim | Senha do banco |
| `MAIL_HOST` | Sim em produção | Não | Servidor SMTP |
| `MAIL_PORT` | Não | Não | Porta SMTP (padrão 587) |
| `MAIL_USERNAME` | Sim em produção se SMTP autenticado | Sim | Usuário SMTP |
| `MAIL_PASSWORD` | Sim em produção se SMTP autenticado | Sim | Senha SMTP |
| `MAIL_FROM` | Sim em produção | Não | Remetente |
| `MAIL_FROM_NAME` | Não | Não | Nome do remetente |
| `JWT_SECRET` | Sim em produção | Sim | Chave de assinatura de token (mín. 32 caracteres em produção) |
| `JWT_EXPIRATION` | Não | Não | Validade do token em milissegundos |
| `PASSWORD_RESET_TOKEN_EXPIRATION_MINUTES` | Não | Não | Validade do token de recuperação (padrão 30) |
| `MAX_LOGIN_ATTEMPTS` | Não | Não | Teto opcional de tentativas (0 = só bloqueio progressivo de 5s) |
| `LOGIN_LOCK_INCREMENT_SECONDS` | Não | Não | Incremento do bloqueio por erro (padrão 5) |
| `CORS_ALLOWED_ORIGINS` | Sim em produção | Não | Origens permitidas, separadas por vírgula. Nunca `*` em rotas autenticadas |
| `INITIAL_ADMIN_NAME` | Sim na 1ª subida | Não | Nome do administrador da plataforma |
| `INITIAL_ADMIN_EMAIL` | Sim na 1ª subida | Não | E-mail do administrador da plataforma |
| `INITIAL_ADMIN_PASSWORD` | Sim na 1ª subida | Sim | Senha inicial. Usada só no bootstrap; persistida como hash |
| `MERCADOPAGO_PUBLIC_KEY` | Sim para PIX/cartão | Não | Chave pública do Mercado Pago |
| `MERCADOPAGO_ACCESS_TOKEN` | Sim para PIX/cartão | Sim | Token de acesso do Mercado Pago |
| `MERCADOPAGO_WEBHOOK_SECRET` | Sim em produção | Sim | Segredo da assinatura do webhook |

## Regras

- Variáveis `VITE_*` são públicas (entram no bundle do navegador).
- `DATABASE_PASSWORD`, `JWT_SECRET`, `MAIL_PASSWORD` e `INITIAL_ADMIN_PASSWORD` nunca vão para o frontend.
- Em produção, a ausência de configuração crítica impede a subida. A mensagem não inclui o valor do secret.
- Preços oficiais de contratação: tabela `plano` no PostgreSQL. `VITE_PLANO_*` é só vitrine.

## Contagem (Fase 1)

- Variáveis documentadas: 33
- Secrets: `DATABASE_USERNAME` (em produção), `DATABASE_PASSWORD`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `JWT_SECRET`, `INITIAL_ADMIN_PASSWORD`
- Obrigatórias em desenvolvimento para subir a API: `DATABASE_HOST`, `DATABASE_NAME`
- Obrigatórias em produção: banco, SMTP, JWT, CORS, administrador inicial
