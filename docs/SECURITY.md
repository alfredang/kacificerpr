# Security design

Kacific ERP is built "secure by default"; this documents what is implemented, where.

| Concern | Implementation | Where |
| --- | --- | --- |
| Password storage | argon2id (m=19 MiB, t=2, p=1) | `src/server/security/password.ts` |
| Sessions | HS256 JWT in an `httpOnly; SameSite=Lax; Secure(prod)` cookie, 8 h, carrying `session_version`; `requireUser()` re-checks the user row so resets, role changes and deactivation revoke live sessions | `src/server/auth/session.ts` |
| Route protection | `proxy.ts` gate (JWT signature) + `requireUser()` / `requireAction()` in every layout, page, server action and route handler | `src/proxy.ts`, `src/server/auth/*` |
| Authorization | One RBAC matrix (`can(role, action)`) used by the UI, server actions, the external API and the sidebar | `src/server/auth/rbac.ts` |
| PO state machine | Transitions and role gates in a pure table; the service re-reads the row `FOR UPDATE` inside a transaction before every transition | `src/lib/po-status.ts`, `src/server/services/po.ts` |
| Login abuse | Rate limit 5 / 15 min per IP+email (Postgres-backed — serverless has no shared memory), lockout after 10 failures, constant-time path for unknown accounts, identical error copy | `src/server/services/auth.ts`, `src/server/security/rate-limit.ts` |
| Password reset / invite | 32-byte random token, only SHA-256 stored, 30 min / 72 h expiry, single-use via `UPDATE … WHERE used_at IS NULL`, forgot-password never reveals whether an account exists | `src/server/security/tokens.ts` |
| Email approval links | Same token model, 72 h, approve/reject twins voided together; **GET renders a confirm page, only POST mutates** (mail scanners prefetch links) | `src/app/approvals/[token]` |
| Secrets at rest | AES-256-GCM with `APP_ENCRYPTION_KEY`, versioned ciphertext (`v1:`), only last-4 shown, never sent to the client | `src/server/security/crypto.ts`, `src/server/services/settings.ts` |
| External API | Bearer keys hashed (SHA-256, timing-safe compare), scoped, bound to a service-account role, revocable, 60 req/min, cookies never accepted | `src/server/api/v1.ts`, `src/server/services/api-keys.ts` |
| Webhooks | Outbound HMAC-SHA256 signatures + timestamp, https-only URLs, 5 s timeout, bounded retries; inbound signature verification and rate limiting | `src/server/webhooks/deliver.ts`, `src/app/api/webhooks/*` |
| Cron | `CRON_SECRET` bearer check with timing-safe compare | `src/app/api/cron/tick/route.ts` |
| Input validation | Zod on every server action, route handler and agent tool input | `src/server/actions/*`, `src/server/agents/tools.ts` |
| Injection | Drizzle parameterised queries only; React escapes output; no `dangerouslySetInnerHTML` | everywhere |
| AI agents | Read-only tools plus `propose_*`; nothing is written until a human clicks Apply; every run, tool call and token count is logged | `src/server/agents/*` |
| Headers | CSP, HSTS (preload), `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy, Permissions-Policy, `poweredByHeader: false` | `next.config.ts` |
| CSRF | Server Actions rely on Next.js origin checks; the external API is Bearer-only; cookies are `SameSite=Lax` | — |
| Audit | Every mutation (auth, PO, invoice, settings, keys, API/MCP calls) lands in `audit_log` with actor, IP and payload; PO events are a separate per-PO timeline | `src/server/services/audit.ts` |
| Dev-only surfaces | `/dev/mailbox` returns 404 in production unless `ALLOW_DEV_MAILBOX=1` | `src/app/dev/mailbox` |
| Supply chain | `pnpm audit` in CI, lockfile committed, no external scripts/CDNs at runtime, fonts self-hosted by `next/font` | `.github/workflows/ci.yml` |

## Operational notes

- Rotate `APP_ENCRYPTION_KEY` by decrypting with the old key and re-encrypting (ciphertexts are versioned to make this a scripted job).
- Rotate `AUTH_SECRET` to sign everyone out at once.
- Seeded accounts (`admin1…6@kacific.com` / `admin12345`, the `*@kacific.example` roles) are for the prototype only — deactivate them under Settings → Users before real use.
- Deploy behind TLS; the cookie is `Secure` in production and HSTS is preloaded.
