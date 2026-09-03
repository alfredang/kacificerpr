---
description: Reseed the demo dataset (idempotent). Pass "reset" to wipe the schema first.
allowed-tools: Bash
---
If `$ARGUMENTS` contains `reset`: `pnpm db:reset && pnpm db:migrate`. Then `pnpm db:seed` and print the login table it outputs.
