---
name: deploy
description: Deploying Kacific ERP — Vercel (CLI or GitHub-driven CD), Neon production/preview branches, required environment variables, Docker Compose self-hosting, and post-deploy smoke checks. Use for any release, env-var or hosting task.
---
# Deploy

**Environments**: Vercel project `kacific-erp` linked to GitHub `alfredang/kacificerpr` — push to `main` = production (`.github/workflows/deploy.yml` migrates Neon then `vercel deploy --prebuilt --prod`); PRs = preview with a seeded Neon branch. Manual: `vercel login` → `vercel link` → `vercel --prod`.

**Env vars** (Vercel → Settings → Environment Variables, or `vercel env add NAME production`): `DATABASE_URL` (Neon pooled), `DB_DRIVER=neon`, `AUTH_SECRET`, `APP_ENCRYPTION_KEY`, `CRON_SECRET`, `APP_URL=https://<domain>`, `EMAIL_TRANSPORT=resend`, `RESEND_API_KEY`, `EMAIL_FROM`, optional `DEEPSEEK_API_KEY`, `ASANA_PAT`, `ASANA_PROJECT_GID`, `TELEGRAM_*`. Never echo values; check presence with `vercel env ls`. GitHub secrets for CD: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `NEON_API_KEY`, `NEON_PROJECT_ID`, `DATABASE_URL`, `APP_ENCRYPTION_KEY` (`gh secret set NAME`).

**Order for a first production deploy**: create Neon project (`neonctl projects create --name kacific-erp --org-id org-twilight-voice-91733704 --region-id aws-ap-southeast-1`) → `DATABASE_URL=<pooled> DB_DRIVER=neon pnpm db:migrate && pnpm db:seed` → set Vercel env → deploy → `/smoke <url>` → `vercel git connect` so CD takes over. Cron: `vercel.json` schedules `/api/cron/tick` daily (Hobby limit; use `*/5 * * * *` on Pro). Vercel sends `CRON_SECRET`.

**Docker**: `docker compose --profile app up -d --build` (see docs/DOCKER.md); CI publishes `ghcr.io/alfredang/kacificerpr:latest`.

**Smoke**: `/api/health` 200, `/login` has HSTS + CSP, `/api/v1/low-stock` 401 without key, `/dev/mailbox` 404 in production, log in as admin1@kacific.com, open a PO.
