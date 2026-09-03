---
description: Deploy to Vercel (preview by default, "prod" for production) with Neon migrations applied first, then smoke test.
allowed-tools: Bash, Read
---
Follow `.claude/skills/deploy/SKILL.md`. In short: `vercel whoami` (ask the user to run `vercel login` if it fails) → `vercel link` if `.vercel/` is missing → apply migrations to the target Neon branch with `DATABASE_URL=… DB_DRIVER=neon pnpm db:migrate` → `vercel --prod` when `$ARGUMENTS` is `prod`, else `vercel` → `curl -fsS <url>/api/health` and `curl -I <url>/login | grep -i strict-transport` → report the URL.
