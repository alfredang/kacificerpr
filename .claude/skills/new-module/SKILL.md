---
name: new-module
description: Step-by-step recipe for adding a sidebar module (e.g. Goods Receipts, Contracts) to Kacific ERP so it matches the existing architecture — schema, service, Zod actions, pages, RBAC, nav, seed, tests. Use when asked to add a new section, entity or page.
---
# Adding a module `<name>`

1. **Schema** `src/db/schema.ts`: table with uuid PK, timestamps, FKs with onDelete, indexes for list columns; relations; export the row type. `pnpm db:generate && pnpm db:migrate`.
2. **Service** `src/server/services/<name>.ts`: `list…(filters)`, `get…(id)`, `create/update…(input, actor)`; wrap multi-table writes in `db.transaction`; call `audit()` and, if it concerns a PO, `recordPoEvent()`; `emit()` a webhook event if downstream systems care (add it to `WEBHOOK_EVENTS`).
3. **RBAC** `src/server/auth/rbac.ts`: add `<name>.view` / `<name>.manage` to `ACTIONS` and the role matrix.
4. **Actions** `src/server/actions/<name>.ts`: `"use server"`, `requireAction`, Zod schema, `revalidatePath`, return `{ error }` — never throw to the client.
5. **Pages** `src/app/(app)/<name>/page.tsx` (+ `[id]`, `new`): server components using `PageHeader`, `Card`, `Table`, `Badge`; client forms with `useActionState` in `src/components/<name>/`. Use `SearchParams` from `src/lib/types.ts`; `export const dynamic = "force-dynamic"`.
6. **Nav** `src/components/shell/nav.ts`: add the entry with its lucide icon and RBAC action.
7. **Agent/API**: if agents or Hermes should read it, add a tool to `src/server/agents/tools.ts` (Zod input, scope) — it appears automatically in `/api/v1/mcp` and can be exposed as a REST route with `withApi`.
8. **Seed** `scripts/seed.ts`: idempotent demo rows.
9. **Tests**: pure logic in `tests/unit`, a happy-path spec in `tests/e2e`, then `/test`.
10. Update `CLAUDE.md` (module list) and, if the domain rules changed, `.claude/skills/erp-domain/SKILL.md`.
