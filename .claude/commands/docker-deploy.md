---
description: Build and run the whole stack with Docker Compose (Postgres + migrate/seed + app + cron) and smoke test it.
allowed-tools: Bash
---
1. Ensure `.env.docker` exists (copy from `.env.docker.example`, generate secrets with `openssl rand -base64 32`).
2. `docker compose --profile app up -d --build`.
3. Wait for `docker compose --profile app ps` to show `app` healthy and `migrate` exited 0; `curl -fsS localhost:3000/api/health`.
4. Report the logins printed by `docker compose --profile app logs migrate | tail -12`.
