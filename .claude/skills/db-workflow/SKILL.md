---
name: db-workflow
description: How database changes flow in Kacific ERP — Drizzle schema → generated migration → migrate → idempotent seed, on local Docker Postgres or Neon branches, and how the driver switch works. Use for any schema, migration, seed or Neon task.
---
# Database workflow

- Schema: `src/db/schema.ts` (single file, enums first). Money = `numeric(14,2)` mode number; timestamps = timestamptz; every list query gets an index.
- Change → `pnpm db:generate` (writes `drizzle/NNNN_*.sql`; read it) → `pnpm db:migrate` → `pnpm db:seed`. Never `drizzle-kit push` against Neon. Postgres enums are append-only.
- Driver: `src/db/index.ts` picks `pg` unless the host is `*.neon.tech` (or `DB_DRIVER` forces it). Neon uses the WebSocket Pool (transactions work); `middleware/proxy` never touches the DB.
- Local: `pnpm db:local:up` (postgres:16 on :5433, volume `kacific_pgdata`), `pnpm db:local:reset` wipes it. Inspect with `docker compose --profile db exec -T db psql -U kacific -d kacific_erp -c "…"` or `pnpm db:studio`.
- Neon: org `org-twilight-voice-91733704`; `neonctl branches create --project-id <id> --name <name> --parent main`; connection string via `neonctl connection-string <branch> --project-id <id> --pooled`. CI creates `preview/pr-N` branches automatically.
- Seed (`scripts/seed.ts`) is idempotent: masters upsert by natural key; POs/invoices insert only if their number is absent; stock is seeded only when `stock_levels` is empty. Logins it creates are listed in docs/DOCKER.md. Extend it by following the same pattern — never truncate.
- Reset for a clean demo: `pnpm db:reset && pnpm db:migrate && pnpm db:seed` (refuses in production unless `ALLOW_DB_RESET=1`).
