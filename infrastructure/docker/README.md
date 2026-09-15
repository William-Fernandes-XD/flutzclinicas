# Docker

O `docker-compose.yml` da raiz sobe PostgreSQL 16, a API Spring e o frontend Vite.

```bash
cp .env.example .env
# ajuste DATABASE_PASSWORD e demais ALTERAR_AQUI
docker compose up --build
```

Secrets não entram na imagem. O backend lê as variáveis em runtime.

- Desenvolvimento local da API sem Compose: PostgreSQL no Compose e `mvn spring-boot:run` no host.
- Produção: a imagem do backend é multi-stage (`backend/Dockerfile`). Frontend de produção será o build estático na Vercel.
