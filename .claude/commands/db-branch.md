---
description: Create a Neon branch for isolated work and point .env.local at it. Usage: /db-branch <name> [parent]
allowed-tools: Bash, Edit
---
1. `neonctl projects list --org-id org-twilight-voice-91733704` to find the kacific-erp project id (or read it from `.neon` if present).
2. `neonctl branches create --project-id <id> --name $1 --parent ${2:-main}`.
3. `neonctl connection-string $1 --project-id <id> --pooled` → replace `DATABASE_URL` in `.env.local` (use Edit; never print the full string).
4. `pnpm db:migrate && pnpm db:seed`.
