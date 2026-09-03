# CLAUDE.md

Guidance for Claude Code when working in this repository. Directory-level `CLAUDE.md`
files under `src/server`, `src/app`, `src/db`, `tests` and `scripts` add local rules;
the skills in `.claude/skills` hold the deeper domain, branding, DB and deploy know-how.

## What this is

**Kacific ERP** — a Next.js 16 / React 19 / TypeScript / Postgres procurement ERP for
Kacific Broadband Satellites (Ka-band satellite broadband, Pacific + SE Asia):
purchase orders with human-in-the-loop approval (in-app, one-click email links, Asana,
Telegram/Hermes), vendor invoices with 3-way match, vendors, SKUs and per-depot stock,
low-stock replenishment, a visual procure-to-pay timeline, DeepSeek-powered agents,
a company settings area (users & roles, integrations, API keys, scheduled tasks,
webhooks) and an external REST + MCP API for agents such as Hermes.

Stack: Next.js App Router (server components + server actions), Tailwind v4 with the
Kacific tokens in `src/app/globals.css`, Drizzle ORM (node-postgres locally, Neon
serverless in the cloud), `jose` sessions, argon2id, Zod, Resend, Recharts, Vitest,
Playwright. Deployed on Vercel + Neon (GitHub Actions CD) or Docker Compose.

## Commands

| Task | Command |
| --- | --- |
| Local DB | `pnpm db:local:up` (postgres:16 on :5433) · `pnpm db:local:reset` |
| Schema | `pnpm db:generate` → `pnpm db:migrate` → `pnpm db:seed` (idempotent) · `pnpm db:reset` |
| Dev | `pnpm dev` → http://localhost:3000 · emails at `/dev/mailbox` |
| Quality | `pnpm lint` · `pnpm typecheck` · `pnpm test` · `pnpm test:e2e` |
| Ops | `pnpm cron:tick` · `pnpm api-key "<name>" <role> <scopes>` · `pnpm docker:up` |

Slash commands: `/dev`, `/test`, `/db-push`, `/db-seed [reset]`, `/db-branch <name>`,
`/deploy [prod]`, `/docker-deploy`, `/cron-tick`, `/api-key`, `/hermes-test`,
`/new-module <name>`, `/security-audit`, `/e2e` (Playwright-MCP QA agent), `/smoke <url>`.
Agents: `erp-qa`, `security-reviewer`, `db-reviewer`. Hooks typecheck after every TS
edit and block commits that stage secrets or `.env*` files.

Seeded logins (password `admin12345`): `admin1…admin6@kacific.com` (admin),
`sales@`, `procurement@`, `operations@kacific.com`. Role demo accounts
(`Kacific2026!`): `admin|manager|procurement|finance|requester|viewer@kacific.example`.

## Architecture in one screen

```
src/proxy.ts                 JWT gate for everything except /login, /approvals, /api/v1, /api/cron, /api/webhooks, /dev
src/app/(auth)/*             login · forgot-password · reset-password/[token]
src/app/(app)/*              sidebar shell → dashboard, purchase-orders, invoices, vendors, skus, low-stock, timeline, asana, agents, settings/*
src/app/approvals/[token]    public one-click approve/reject landing (GET renders, POST decides)
src/app/api/v1/*             external REST (withApi: Bearer → scope → RBAC → rate limit → audit) · openapi.json · mcp
src/app/api/{cron,webhooks,agents}   scheduler tick · Asana/Telegram/generic inbound · Hermes widget chat
src/server/auth              session.ts (jose + session_version) · rbac.ts (THE permission matrix)
src/server/services          po · invoice · sku · vendor · dashboard · settings · users · api-keys · tasks · webhooks · chat · audit
src/server/agents            tools.ts (single registry: DeepSeek + REST + MCP) · runner.ts · prompts.ts
src/server/integrations      email (Resend/outbox) · asana · deepseek · telegram
src/server/{events,jobs,webhooks,security}   event bus + webhook delivery · cron job kinds · crypto/tokens/rate-limit/password
src/lib/po-status.ts         PO state machine (pure) · constants.ts · format.ts
src/db/schema.ts             Drizzle schema · drizzle/ migrations · scripts/seed.ts
```

## Invariants — do not break

- **Authorization is central.** Every server action, page and route calls
  `requireAction()` / `withApi({ scope, action })`; `can()` in `rbac.ts` is the only
  place roles are interpreted. Settings, users and API keys are admin-only.
- **PO status changes only through `transition()`** in `src/lib/po-status.ts`, applied
  by `src/server/services/po.ts` inside a transaction with `FOR UPDATE`. Every change
  writes a `po_events` row (the timeline) and an `audit_log` row.
- **Stock changes only through `adjustStock()`** — a movement row and the level update in
  one transaction. `qty_on_order` is derived from open PO lines, never stored.
- **Tokens are hashed, single-use, expiring.** GET on `/approvals/[token]` and
  `/reset-password/[token]` never mutates; the POST/action does, then redirects.
- **Secrets are encrypted at rest** (`encrypt()`/`decrypt()`), never sent to client
  components, shown as last-4 only. `.env*` files are never read or printed.
- **Agents only propose.** Tools in `src/server/agents/tools.ts` are read-only except
  `propose_*`; `applyRun()` is the single write path and needs `agents.apply`.
- **One tool registry, three surfaces.** Add a capability once in `tools.ts`; REST
  routes, MCP and DeepSeek all pick it up.
- **Every boundary is Zod-validated** (server actions, API bodies, tool inputs).
- **Emails always land in `email_outbox`**; `EMAIL_TRANSPORT=outbox` sends nothing.
- **Brand:** colours/radii come from the `@theme` tokens; status colours stay
  green/amber/red; Montserrat 300/500/600/700; uppercase only on buttons/headers.
- **Next 16 conventions:** `proxy.ts` (not middleware), async `params`/`searchParams`,
  `export const dynamic = "force-dynamic"` on DB-backed pages, `runtime` is Node.

## Testing

`tests/unit` (Vitest) covers the pure logic: state machine, RBAC, crypto, 3-way match,
signing, password policy. `tests/e2e` (Playwright) drives the real app against the
seeded local DB with `INTEGRATIONS_MOCK=1 AI_MOCK=1 EMAIL_TRANSPORT=outbox
LOGIN_RATE_LIMIT=200` and reads approval/reset links from `/dev/mailbox`. If logins
start failing during repeated runs, clear `rate_limits`. `/e2e` launches the
Playwright-MCP QA agent for an exploratory pass.

## Docs

`docs/LOCAL-SETUP.md` · `docs/DOCKER.md` · `docs/HERMES.md` (REST/MCP for external
agents) · `docs/SECURITY.md` (the security contract) · `README.md`.
