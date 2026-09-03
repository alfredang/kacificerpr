# Docker Compose deployment

Reproduces the full prototype — schema, demo data and all logins — on any machine with
Docker. The same image also runs against Neon by changing one variable.

## 1. First run

```bash
git clone https://github.com/alfredang/kacificerpr.git && cd kacificerpr
cp .env.docker.example .env.docker
# edit .env.docker: AUTH_SECRET and APP_ENCRYPTION_KEY = `openssl rand -base64 32`,
#                   CRON_SECRET = any random string, APP_URL = the public URL
docker compose --profile app up -d --build
```

What happens, in order:

1. `db` — `postgres:16-alpine` with a named volume `kacific_pgdata`; waits until healthy.
2. `migrate` — one-shot container (full toolchain image) that runs
   `pnpm db:migrate && pnpm db:seed`: creates every table/enum and loads the demo
   dataset (8 depots, 10 vendors, 34 SKUs with stock, 16 POs across the lifecycle,
   12 invoices, scheduled tasks, and the users below). Idempotent — safe to re-run.
3. `app` — the Next.js standalone image on http://localhost:3000, health-checked at
   `/api/health`.
4. `cron` — a curl sidecar that calls `/api/cron/tick` every 5 minutes with
   `CRON_SECRET`, exactly like Vercel Cron does in the cloud.

Logins after seeding:

| Account | Password | Role |
| --- | --- | --- |
| admin1@kacific.com … admin6@kacific.com | `admin12345` | admin |
| admin@kacific.example | `Kacific2026!` | admin |
| manager@kacific.example | `Kacific2026!` | manager (approves POs) |
| procurement@kacific.example | `Kacific2026!` | procurement |
| finance@kacific.example | `Kacific2026!` | finance |
| requester@kacific.example | `Kacific2026!` | requester |
| viewer@kacific.example | `Kacific2026!` | viewer |

## 2. Day-to-day

```bash
docker compose --profile app logs -f app        # tail the app
docker compose --profile app ps                 # health
docker compose --profile app down               # stop (data kept in the volume)
docker compose --profile app down -v            # stop and wipe the database
docker compose --profile app run --rm migrate   # re-run migrate + seed by hand
```

## 3. Upgrading

```bash
git pull
docker compose --profile app up -d --build      # rebuilds, re-runs migrate, restarts app
```

Or pull the pre-built image published by CI instead of building:
`ghcr.io/alfredang/kacificerpr:latest` (set `image:` on the `app` service).

## 4. Backups

```bash
docker compose exec db pg_dump -U kacific kacific_erp > backup-$(date +%F).sql
cat backup.sql | docker compose exec -T db psql -U kacific kacific_erp
```

## 5. Using Neon instead of the bundled Postgres

Set `DATABASE_URL` (a `*.neon.tech` pooled connection string) and `DB_DRIVER=neon`
on the `app` and `migrate` services and drop the `db` dependency; the driver switch
does the rest.

## 6. TLS / reverse proxy

Put Caddy or Nginx in front of port 3000 and set `APP_URL=https://erp.example.com`
so emailed links and the OpenAPI document use the public origin. The app already sends
HSTS and a strict CSP.
