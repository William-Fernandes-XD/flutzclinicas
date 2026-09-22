# Mercado Pago OAuth (Connect) — Flutz

## Visão geral

Cada clínica conecta a **própria** conta Mercado Pago via OAuth oficial (Connect).
O Flutz **não** pede Public Key / Access Token na interface.

Fluxo de dinheiro:

| Caso | Conta usada |
| --- | --- |
| Mensalidade da clínica → Flutz | Credenciais da **plataforma** (`MERCADOPAGO_PUBLIC_KEY` / `MERCADOPAGO_ACCESS_TOKEN`) |
| Tutor paga agendamento → clínica | Tokens **OAuth da clínica** em `conta_pagamento` |

## Como a clínica conecta

1. Admin da clínica abre **Financeiro → Recebimentos**.
2. Clica em **Conectar Mercado Pago**.
3. O backend gera um `state` (CSRF) ligado à `empresa_id` + usuário e redireciona para o Mercado Pago.
4. A clínica autoriza o aplicativo Flutz.
5. O Mercado Pago chama o callback do backend.
6. O backend troca o `code` por `access_token` + `refresh_token`, grava em `conta_pagamento` e redireciona para `/app/financeiro?mp=conectado`.

## Endpoints

| Método | Caminho | Auth | Função |
| --- | --- | --- | --- |
| `GET` | `/api/clinica/recebimento` | Admin clínica | Status seguro (sem tokens) |
| `GET` | `/api/clinica/recebimento/mercadopago/connect` | Admin clínica | Retorna `authorizationUrl` |
| `GET` | `/api/public/mercadopago/oauth/callback` | Público | Callback OAuth → redirect frontend |
| `POST` | `/api/clinica/recebimento/desconectar` | Admin clínica | Remove tokens / marca DESCONECTADA |
| `POST` | `/api/public/mercadopago/webhook` | Público | Webhooks (assinatura + agendamentos) |

## Tokens

- Armazenados só no backend (`conta_pagamento.access_token`, `refresh_token`, `token_expires_at`).
- **Nunca** enviados ao frontend.
- Antes de criar/consultar pagamento de agendamento, `MercadoPagoOAuthService.exigirCredenciaisValidas(empresaId)`:
  1. carrega a conta da **mesma** `empresa_id`;
  2. se OAuth e o token está perto de expirar, usa o refresh token;
  3. atualiza o banco;
  4. devolve access token válido.

## Isolamento multi-clínica

- O `state` OAuth amarra o callback à clínica que iniciou.
- Pagamentos de agendamento usam `exigirCredenciais(empresaId)` do agendamento — nunca o token de outra clínica.
- Desconectar exige admin + contexto da empresa atual.

## Desconexão

Invalida `access_token` / `refresh_token` e marca `DESCONECTADA`.
Não apaga `pagamento`, agendamentos nem histórico financeiro.

## Fallback legado

Clínicas que já tinham Public Key + Access Token colados (`auth_mode = manual`) continuam funcionando internamente.
A UI não oferece mais o formulário de colar chaves — a recomendação é desconectar e conectar via OAuth.

## Variáveis de ambiente

### Plataforma (mensalidade Flutz)

```
MERCADOPAGO_PUBLIC_KEY=
MERCADOPAGO_ACCESS_TOKEN=
MERCADOPAGO_WEBHOOK_SECRET=
```

### OAuth Connect (contas das clínicas)

```
MERCADOPAGO_CLIENT_ID=
MERCADOPAGO_CLIENT_SECRET=
MERCADOPAGO_REDIRECT_URI=
```

## Onde pegar Client ID e Client Secret

No painel da aplicação → **Detalhes da aplicação**:

| Variável | O que é | Exemplo de formato |
| --- | --- | --- |
| `MERCADOPAGO_CLIENT_ID` | **Número da aplicação** (App ID) | `1234567890123456` (só números) |
| `MERCADOPAGO_CLIENT_SECRET` | **Client Secret** da aplicação | string própria do painel |
| `MERCADOPAGO_REDIRECT_URI` | URL de callback cadastrada no app | `http://localhost:8080/api/public/mercadopago/oauth/callback` |

**Não use** Public Key nem Access Token (`APP_USR-…`) nesses campos — isso quebra a tela de autorização do Mercado Pago.

Também cadastre a Redirect URI **idêntica** em: edição da aplicação → URLs de redirecionamento.

O Flutz envia **PKCE (S256)** no Connect. Se no painel existir a opção *Usar o fluxo de authorization code com PKCE*, deixe **ligada** (recomendado). Se estiver desligada, o MP costuma aceitar os parâmetros mesmo assim.

Se aparecer **"O aplicativo não está pronto para se conectar a Mercado Pago"**:

1. Abra [Suas integrações](https://www.mercadopago.com.br/developers/panel/app) → app cujo **Número** = `MERCADOPAGO_CLIENT_ID`.
2. **Editar** e preencha os dados obrigatórios (nome, descrição, indústria, solução = pagamentos online / Checkout Transparente).
3. Em **Configurações avançadas**, cadastre a **Redirect URL** exatamente igual a `MERCADOPAGO_REDIRECT_URI` (mesmo protocolo, host, porta e path — sem barra no final a mais).
4. Salve, aguarde alguns segundos e tente **Conectar** de novo.

## Produção (flutzclinicas.com.br)

| Peça | Valor |
| --- | --- |
| Frontend (Vercel) | `https://flutzclinicas.com.br` |
| API | `https://api.flutzclinicas.com.br` |
| Redirect OAuth (preferida) | `https://flutzclinicas.com.br/api/public/mercadopago/oauth/callback` |
| Redirect OAuth (direto na API) | `https://api.flutzclinicas.com.br/api/public/mercadopago/oauth/callback` |

### Por que “página não existe” no callback

O domínio do site é a **Vercel** (SPA). Sem proxy, `/api/...` vira `index.html` e a rota Spring nunca roda.

O `frontend/vercel.json` encaminha `/api/*` → `https://api.flutzclinicas.com.br/api/*`. **É preciso publicar o frontend** depois dessa alteração.

### Checklist produção

1. No servidor da API, use o modelo `.env.production.example`:
   - `APP_URL=https://api.flutzclinicas.com.br`
   - `FRONTEND_URL=https://flutzclinicas.com.br`
   - `MERCADOPAGO_REDIRECT_URI=https://flutzclinicas.com.br/api/public/mercadopago/oauth/callback`
   - Client ID / Secret / Public Key / Access Token de **produção**
2. No painel MP, cadastre **exatamente** essa Redirect URL (pode cadastrar as duas: site + `api.`).
3. Redeploy da Vercel com o `vercel.json` atualizado.
4. Teste: `https://flutzclinicas.com.br/api/public/health-message` deve responder JSON `{"status":"ok"}` (não HTML).
5. Em **Financeiro → Conectar Mercado Pago** pelo site de produção.

Localmente continue com `http://localhost:5173/api/public/mercadopago/oauth/callback` no `.env` e no painel (segunda URL).

## Migration

`V30__mercadopago_oauth.sql` — colunas OAuth em `conta_pagamento` + tabela `mercadopago_oauth_state`.
`V31__mercadopago_oauth_pkce.sql` — PKCE (`code_verifier`).
