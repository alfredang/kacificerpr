---
description: Run lint, typecheck, unit tests and the Playwright e2e suite; fix what fails.
allowed-tools: Bash, Read, Edit
---
Run in order and stop at the first failure, fixing root causes (not tests) unless the test itself is wrong:
1. `pnpm lint`
2. `pnpm typecheck`
3. `pnpm test`
4. Ensure the dev server is up (see /dev) with `INTEGRATIONS_MOCK=1 AI_MOCK=1 EMAIL_TRANSPORT=outbox LOGIN_RATE_LIMIT=200` in `.env.local`, clear rate limits (`docker compose --profile db exec -T db psql -U kacific -d kacific_erp -c "delete from rate_limits;"`), then `E2E_BASE_URL=http://localhost:3000 pnpm test:e2e`.
Report pass/fail counts. $ARGUMENTS may name a single spec or `--grep` pattern to narrow the e2e run.
