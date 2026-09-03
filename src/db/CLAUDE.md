# src/db — rules

- `schema.ts` is the single source; run `pnpm db:generate` after any change and commit
  the migration in `drizzle/`. Enums are append-only. Never `drizzle-kit push` on Neon.
- Money: `numeric(14,2)` with `mode: "number"`; timestamps: `timestamptz`; ids: uuid.
- FKs declare `onDelete`; list/filter columns get indexes.
- `index.ts` lazily creates one pool per process (`pg` locally, Neon WebSocket driver for
  `*.neon.tech`) — never open a pool elsewhere, never import `getDb()` at module top level
  in edge code (`src/proxy.ts`).
- Seed data lives in `scripts/seed.ts` and must stay idempotent.
