# Arquitetura inicial — Flutz

## Stack final

| Camada | Escolha | Motivo |
| --- | --- | --- |
| Frontend | React + TypeScript + Vite + Tailwind + React Router | Independente, hospedável na Vercel |
| Animações | Motion (`motion/react`) | Pedido de motion profissional; GSAP/Anime/Vivus ficam de fora da landing para não inflar o bundle |
| Cache remoto | TanStack Query (instalado) | Cache por chave/tenant na Fase 5+; não substitui o banco |
| Auth no browser | Cookie httpOnly (Fase 3) | Evita JWT em `localStorage` |
| Backend | Java 21, Spring Boot 3.5, Maven | Pacote `br.com.upvibe.flutz` |
| Persistência | PostgreSQL 16 + Flyway + JPA | Conversão autorizada do script MySQL |
| Docs da API | springdoc / OpenAPI | Consumo pelo frontend |
| Toasts (Fase 5) | Growl no canto superior direito, visual mais moderno que PrimeFaces | Mesmo papel de `p:growl` |

## Estrutura de pastas

```text
/
├── frontend/                 # React (Vercel)
├── backend/                  # Spring Boot
├── database/
│   ├── mysql/                # histórico Workbench
│   └── postgresql/           # fonte da implementação
├── infrastructure/
│   ├── docker/
│   └── kubernetes/
├── docs/
├── .env.example
└── README.md
```

## Fluxo

```text
Browser (React)
    → HTTPS / REST
API (Controller)
    → validação de DTO
Service
    → regra + tenant do contexto autenticado
Repository / JPA
    → PostgreSQL (schema flutz)
```

O frontend nunca é fonte de verdade de preço, permissão ou isolamento.

## Autenticação (Fase 3 — desenhada, não implementada)

Três atores, sem tabela `usuario`:

| Ator | Tabela | Login |
| --- | --- | --- |
| Dono da plataforma | `administrador_sistema` | e-mail + senha |
| Equipe da clínica | `colaborador` | e-mail + senha + `role` |
| Tutor | `cliente` | CPF + senha |

Senha só como `senha_hash` (BCrypt/Argon2). Token de sessão em cookie httpOnly + CSRF na Fase 3. Recuperação: `recuperacao_senha` (hash, uso único, validade por `.env`). Mensagem genérica para não enumerar contas.

Bloqueio progressivo de login: +5s por erro, no backend, estado compartilhado (não memória local da instância) para as 3 réplicas.

## Multi-tenancy

`empresa` é o tenant. O backend resolve o tenant pelo usuário autenticado. `empresaId` vindo do cliente é sempre confrontado com esse contexto.

Não colocar `empresa_id` onde o tenant já é inequívoco (`pet.empresa_id` determina históricos; `cliente` é global via `empresa_cliente`).

## Segurança

- Validação Bean Validation nos DTOs; entidades JPA não expostas
- Queries parametrizadas (JPA)
- Headers: CSP, nosniff, frame deny, referrer-policy
- CORS só com origens do `.env`
- XSS: encoding na saída + CSP; sem filtro de palavras
- SQL: sem concatenação
- Sem secrets no frontend, Dockerfile ou manifests versionados
- Cookie banner: apenas cookies estritamente necessários nesta fase

## Docker

Compose local: PostgreSQL + API + frontend de desenvolvimento. Secrets injetados em runtime. Imagens sem `ENV` de senha/JWT.

## Kubernetes

Deployment do backend com `replicas: 3`, Service, ConfigMap, Secret (exemplo sem valores reais), liveness `/actuator/health/liveness`, readiness `/actuator/health/readiness`. Aplicação stateless: sem sessão em memória local.

## Três instâncias

Qualquer estado compartilhado (bloqueio de login, cache de recuperação) precisará de Redis ou persistência no PostgreSQL na Fase 3. Não usar arquivo local nem `HttpSession` em memória.

## Preços

Fonte oficial: `plano.valor_mensal`. Seed inicial em `V2` (99.90 / 199.90 / 299.90). A landing só exibe `VITE_PLANO_*`. Contratação futura ignora valor enviado pelo browser.

## Ordem de implementação

1. **Fase 1 (esta entrega):** estrutura, landing, conexão, Flyway, Docker/K8s esqueleto, env
2. **Fase 2:** entidades JPA, repositórios, services, DTOs
3. **Fase 3:** Security, login, tenant, bloqueio, recuperação de senha, admin inicial
4. **Fase 4:** API REST de negócio + OpenAPI completo
5. **Fase 5:** painel autenticado
6. **Fase 6:** módulos do SaaS
7. **Fase 7:** produção K8s
8. **Fase 8:** testes de isolamento e segurança

## Decisões

| Problema | Solução | Motivo | Impacto |
| --- | --- | --- | --- |
| Script era MySQL e a API exige PostgreSQL | Conversão autorizada, histórico MySQL preservado | Mesmo modelo, SGBD da arquitetura | Flyway V1 em PostgreSQL |
| Recuperação de senha sem tabela | `recuperacao_senha` autorizada | Token de alta entropia, hash, uso único | Fluxo de e-mail na Fase 3 |
| GSAP + Anime + Vivus + Motion | Só Motion na landing | Performance e `prefers-reduced-motion` | Bibliotecas de SVG/timeline entram só se uma tela precisar |
| Preço no `.env` vs tabela `plano` | DB oficial; env só vitrine/seed | Impede adulterar valor no browser | Endpoint público de planos na Fase 4 |
| JWT em localStorage | Recusado | Risco de XSS | Cookie httpOnly na Fase 3 |
