# tests — rules

- `unit/`: pure functions only (no DB); import from `@/lib/*` or `@/server/*` modules that
  do not touch `server-only`. Config in `vitest.config.mts`.
- `e2e/`: Playwright against a seeded local DB with mocks (`INTEGRATIONS_MOCK`, `AI_MOCK`,
  `EMAIL_TRANSPORT=outbox`, `LOGIN_RATE_LIMIT=200`). Specs create their own POs; only
  seeded SKUs/vendors are referenced by name. Use role-based locators; add `.first()` /
  `.last()` when text repeats. Links from emails come from `/dev/mailbox` via
  `latestMailLink()` in `helpers.ts`.
- Keep the procure-to-pay spec serial; everything else independent.
