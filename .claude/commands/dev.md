---
description: Start the ERP on localhost (Docker Postgres + Next dev) and confirm /api/health.
allowed-tools: Bash
---
1. `pnpm db:local:up` (idempotent) and wait until `docker compose --profile db ps` shows healthy.
2. If `.env.local` is missing, copy `.env.example` and fill `AUTH_SECRET`, `APP_ENCRYPTION_KEY`, `CRON_SECRET` with `openssl rand -base64 32`.
3. `pnpm db:migrate` then `pnpm db:seed` (both idempotent).
4. Start `pnpm dev --port 3000` in the background and poll `curl -sf localhost:3000/api/health` until it returns `{"ok":true}`.
5. Report the URL and the seeded logins (admin1@kacific.com / admin12345).
