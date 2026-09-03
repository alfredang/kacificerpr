# src/app — rules

- Route groups: `(auth)` public, `(app)` behind the sidebar shell (`requireUser()` in the
  layout), `approvals/[token]` public, `dev/*` dev-only (404 in production).
- DB-backed pages export `dynamic = "force-dynamic"` and await `params` / `searchParams`
  (`SearchParams` + `sp()` from `src/lib/types.ts`). Route-typed `PageProps` are not used.
- Server components fetch through services and pass plain data to client components
  (`"use client"` files live under `src/components/*`, never inline in pages).
- Client forms use `useActionState` with the shared `ActionResult`/`SettingsResult`
  shapes and render `<Alert>` for errors; no `alert()`/`confirm()` except destructive
  deletes.
- API routes under `api/v1` are wrapped with `withApi`; `api/cron`, `api/webhooks` verify
  secrets with `safeEqual`; `api/agents/chat` is cookie-auth + same-origin only.
- Layout/UI primitives come from `src/components/ui/*` (`Button`, `Card`, `Table`, `Badge`,
  `Field`, `KpiCard`, `PageHeader`, `Alert`, `EmptyState`). Add a variant there rather than
  bespoke classes. Charts use `BrandBarChart`.
- Keep React purity rules (eslint `react-hooks/*`): no `Date.now()` in render — compute in
  services or actions and pass down.
