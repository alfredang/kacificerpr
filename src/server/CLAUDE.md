# src/server — rules

- Services are the only place business rules live; pages and actions are thin. A service
  takes an `Actor` (see `services/audit.ts`) and writes `audit_log` (+ `po_events` when a
  PO is involved) inside the same transaction as the change.
- Multi-table writes use `db.transaction`; lock rows you transition with `.for("update")`.
- Throw typed errors (`PoError`, `InvoiceError`) with user-readable messages; server
  actions translate them into `{ error }`. Never leak stack traces or SQL.
- Every server action: `"use server"` → `requireAction()` → Zod → service →
  `revalidatePath` → return `{ ok }` / `{ error }`. Redirect only after success.
- Integrations (`integrations/*`) must degrade: mock mode (`INTEGRATIONS_MOCK=1`),
  disabled, or failing must never block a PO transition — log an event instead.
- Anything callable by agents goes into `agents/tools.ts` with a scope; do not add
  parallel query code in REST routes.
- Secrets: only via `resolveIntegration()`; never `process.env.X` directly in services
  (settings override env).
- `session.ts` imports `server-only`; never import it from scripts or tests.
