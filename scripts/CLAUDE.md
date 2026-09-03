# scripts — rules

Node scripts run with `tsx` outside Next: import `./_env` first (loads `.env.local`),
use `getDb()` from `../src/db`, never import `server-only` modules. `seed.ts` must stay
idempotent and print the login table; `migrate.ts` picks the migrator for the active
driver; `reset.ts` refuses production without `ALLOW_DB_RESET=1`.
