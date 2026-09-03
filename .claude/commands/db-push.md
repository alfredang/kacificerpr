---
description: Generate a Drizzle migration from src/db/schema.ts and apply it to the current DATABASE_URL.
allowed-tools: Bash, Read
---
1. `pnpm db:generate` — inspect the new file under `drizzle/`; if it drops a column or table, STOP and confirm with the user.
2. `pnpm db:migrate`.
3. `pnpm db:seed` (idempotent) and `pnpm typecheck`.
Never use `drizzle-kit push` against Neon; migrations are the only path.
