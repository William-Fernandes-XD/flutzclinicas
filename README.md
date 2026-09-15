# Flutz

SaaS multiempresa para clínicas veterinárias, desenvolvido pela [UpVibe](https://www.upvibe.blog.br/).

Cada clínica (`empresa`) tem o próprio ambiente. Isolamento de dados é responsabilidade do backend.

## O que já existe

- Modelo físico e regras de negócio em `docs/modelo-fisico-saas-veterinario.md`
- Schema PostgreSQL + Flyway (Fase 1)
- Landing comercial em `/`
- API Spring Boot com health, CORS, headers e OpenAPI
- Docker Compose e manifests Kubernetes (3 réplicas)

## Stack

- Frontend: React, TypeScript, Tailwind, React Router, Motion — Vercel
- Backend: Java 21, Spring Boot, JPA, Flyway — PostgreSQL 16
- Infra: Docker, Kubernetes

## Como subir (local)

1. Copie `.env.example` para `.env` e troque os `ALTERAR_AQUI`.
2. No frontend, copie `frontend/.env.example` para `frontend/.env` se ainda não existir.
3. PostgreSQL + API:

```bash
docker compose up postgres --build
cd backend
mvn spring-boot:run
```

4. Landing:

```bash
cd frontend
npm install
npm run dev
```

Ou tudo via `docker compose up --build`.

- Landing: http://localhost:5173/
- API health: http://localhost:8080/api/public/health-message
- Swagger: http://localhost:8080/swagger-ui
- Actuator: http://localhost:8080/actuator/health

## Rotas públicas do frontend

| Rota | Uso |
| --- | --- |
| `/` | Landing comercial |
| `/login` | Login (placeholder nesta fase) |
| `/cadastro?plano=` | Cadastro (placeholder) |
| `/app` | Sistema autenticado (futuro) |
| `/clinica/:slug` | Página pública da clínica (futuro) |
| `/403` | Sem permissão |
| `*` | 404 |

## Documentação

- [Arquitetura](docs/arquitetura.md)
- [Variáveis de ambiente](docs/configuration.md)
- [Modelo físico](docs/modelo-fisico-saas-veterinario.md)

## Fase atual

**Fase 1 — estrutura.** Sem CRUD de clínica, sem login real e sem gateway de pagamento.
O preço exibido na landing é de apresentação; o valor oficial está em `plano.valor_mensal`.
