#!/usr/bin/env bash
# Stop: remind about unapplied schema changes so migrations are never forgotten.
cd "$(dirname "$0")/../.." || exit 0
if git status --porcelain 2>/dev/null | grep -q "src/db/schema.ts"; then
  latest=$(ls -t drizzle/*.sql 2>/dev/null | head -1)
  if [ -z "$latest" ] || [ src/db/schema.ts -nt "$latest" ]; then
    echo "Reminder: src/db/schema.ts changed but no newer migration exists — run pnpm db:generate && pnpm db:migrate."
  fi
fi
exit 0
