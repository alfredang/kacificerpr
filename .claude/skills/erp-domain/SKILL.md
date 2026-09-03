---
name: erp-domain
description: Kacific ERP domain rules — the PO state machine, RBAC matrix, 3-way match, low-stock maths, events/webhooks, agent tool registry and the external API contract. Read before changing anything under src/server or adding a workflow step.
---
# Domain rules

**Purchase orders** (`src/lib/po-status.ts`, `src/server/services/po.ts`): draft → pending_approval → approved|rejected → ordered → received → closed; cancel from draft/pending/approved/rejected/ordered; rejected → reopen → draft. `transition()` is the only way status changes; services lock the row `FOR UPDATE` and re-check inside the transaction. Roles per action live in `ACTION_ROLES`; RBAC actions in `src/server/auth/rbac.ts` (settings/users/API keys are admin-only). PO numbers come from `company_settings.next_po_seq` via UPDATE…RETURNING.

**Submit** issues one approve+reject token pair per active manager/admin (72 h), emails them (`approvalRequestEmail`), creates the Asana task (best effort), records `submitted` + `approval_email_sent` events and emits `po.submitted`. Under `approval_threshold` (>0) it auto-approves. **Decide** voids all tokens for the PO, completes the Asana task, emails the requester, emits `po.approved|rejected`.

**Receiving** is per line and idempotent (capped at qty); stock moves (`adjustStock`) in the same transaction; full receipt flips to received.

**Invoices** (`src/server/services/invoice.ts`): received → matched (all four checks) → approved → paid; disputed ↔ received. `computeMatch`: PO exists & vendor matches; invoiced qty ≤ ordered; invoiced qty ≤ received; unit price within `price_tolerance_pct`.

**Low stock** (`lowStockList`): network-wide on-hand < reorder level; suggested = shortfall + reorder qty − on order; grouped by preferred vendor; "Generate PO" = `/purchase-orders/new?from=low-stock&vendor=<id>`.

**Events** (`src/server/events.ts`): `recordPoEvent` → per-PO timeline; `emit(event)` → signed webhook deliveries with retries. Event names in `WEBHOOK_EVENTS`.

**Agents** (`src/server/agents/tools.ts`): one registry; tools are read-only except `propose_*`; the runner (`runner.ts`) persists `agent_runs` first, loops ≤ 8 tool steps, and only `applyRun` writes (creates draft PO / moves invoice). `AI_MOCK=1` yields deterministic runs. Same registry backs `/api/v1` (`withApi` wrapper: Bearer → scope → RBAC → rate limit → audit) and `/api/v1/mcp`.

**Scheduler**: `scheduled_tasks` claimed with UPDATE…RETURNING on `next_run_at`; job kinds in `src/server/jobs/index.ts`; ticked by `/api/cron/tick`.

Adding a workflow step = add the action to `ACTION_ROLES` + `TRANSITIONS`, a service function that records an event, an RBAC action if needed, a server action with Zod, UI in `PoActionsPanel`, and a unit test in `tests/unit/po-status.test.ts`.
