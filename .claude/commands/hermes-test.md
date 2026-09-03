---
description: Exercise the external API + MCP endpoint end to end with curl. Usage: /hermes-test [base-url]
allowed-tools: Bash
---
BASE=${ARGUMENTS:-http://localhost:3000}. Mint a manager key with all scopes via `pnpm api-key "hermes-test" manager read:stock,read:vendors,read:po,write:po,approve:po,read:invoices`, then: `GET /api/v1/me`, `GET /api/v1/low-stock`, `GET /api/v1/search?q=PO-2026`, `POST /api/v1/purchase-orders` (vendor V-SKY, sku RF-LNB qty 5), `POST …/submit`, MCP `tools/list` and a `tools/call` of `get_sku_stock`, `GET /api/v1/openapi.json`. Assert 401 without a key. Report each status.
