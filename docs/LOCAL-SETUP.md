# Local setup

Three ways to get a working localhost, from most self-contained to most cloud-like.

## Prerequisites

- Node 22 (`nvm use 22`), pnpm 11 (`npm i -g pnpm@11`)
- Docker Desktop (for the local Postgres) — or Homebrew `postgresql@16`
- Optional: `npm i -g vercel neonctl` and `vercel login`, `neonctl auth`

```bash
git clone https://github.com/alfredang/kacificerpr.git
cd kacificerpr
pnpm install
```

## Option A — fully local (Docker Postgres, no cloud accounts)

```bash
cp .env.example .env.local          # DATABASE_URL already points at localhost:5433
openssl rand -base64 32              # paste as AUTH_SECRET
openssl rand -base64 32              # paste as APP_ENCRYPTION_KEY
pnpm db:local:up                     # postgres:16 on localhost:5433 (docker compose --profile db)
pnpm db:migrate                      # applies drizzle/ migrations
pnpm db:seed                         # depots, vendors, SKUs, POs, invoices, users — idempotent
pnpm dev                             # http://localhost:3000
```

Sign in as `admin1@kacific.com` / `admin12345` (or any of the role accounts printed by
the seed: `admin|manager|procurement|finance|requester|viewer@kacific.example` /
`Kacific2026!`).

Useful while developing:

| Command | What it does |
| --- | --- |
| `pnpm db:studio` | Drizzle Studio on the local DB |
| `pnpm db:local:reset` | Wipe the Postgres volume and start fresh (then migrate + seed) |
| `pnpm cron:tick` | Fire the scheduler once (runs due scheduled tasks) |
| `pnpm api-key "Hermes" procurement read:stock,read:po,write:po` | Mint an API key from the CLI |
| http://localhost:3000/dev/mailbox | Every email the app "sent" (approval links, resets) |
| `pnpm test` / `pnpm test:e2e` | Vitest unit tests / Playwright end-to-end |

Without Docker: `brew services start postgresql@16 && createdb kacific_erp`, then set
`DATABASE_URL=postgresql://localhost:5432/kacific_erp`.

## Option B — localhost linked to Vercel + Neon (team setup)

Environment variables live in the Vercel project, so nobody pastes keys by hand.

```bash
vercel login
vercel link                          # choose the kacific-erp project
vercel env pull .env.local --environment=development
pnpm db:migrate && pnpm db:seed      # against the Neon `dev` branch in DATABASE_URL
pnpm dev
```

The driver switch in `src/db/index.ts` picks the Neon WebSocket driver automatically
for `*.neon.tech` hosts and `pg` for everything else, so nothing else changes.

Give yourself a private Neon branch so you can break things freely:

```bash
neonctl branches create --project-id <id> --name $USER --parent dev
neonctl connection-string $USER --project-id <id>   # → DATABASE_URL in .env.local
pnpm db:migrate && pnpm db:seed
```

## Option C — the whole stack in Docker

See [DOCKER.md](DOCKER.md): `docker compose --profile app up -d --build` builds the
image, starts Postgres, runs migrations + seed, starts the app on :3000 and a cron
sidecar.

## Integrations on localhost

Add keys under **Settings → Integrations** (stored encrypted) or in `.env.local`:

| Integration | Variables | Without a key |
| --- | --- | --- |
| DeepSeek | `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL=deepseek-chat` | Agents page shows "not configured"; `AI_MOCK=1` gives canned runs |
| Asana | `ASANA_PAT`, `ASANA_PROJECT_GID` (or `ASANA_WORKSPACE_GID`) | Board shows demo cards from seeded POs |
| Resend | `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_TRANSPORT=resend` | `EMAIL_TRANSPORT=outbox` keeps everything in `/dev/mailbox` |

Set `INTEGRATIONS_MOCK=1` to stub all three in-process (used by the e2e suite).
