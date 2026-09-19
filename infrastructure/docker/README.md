# Docker

O `docker-compose.yml` da raiz sobe PostgreSQL 16 e a API Spring.
O frontend (build estático + nginx) é opcional via profile — em produção use a Vercel.

```bash
cp .env.example .env
# ajuste DATABASE_PASSWORD e demais ALTERAR_AQUI

# API + banco (leve; use no servidor)
docker compose up -d --build

# Incluir frontend estático local na porta 5173
docker compose --profile frontend up -d --build
```

Secrets não entram na imagem. O backend lê as variáveis em runtime.

- Desenvolvimento local do front: `cd frontend && npm run dev` (Vite).
- Produção do front: Vercel ou `docker compose --profile frontend up --build`.
