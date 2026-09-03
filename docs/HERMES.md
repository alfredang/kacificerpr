# Connecting an external agent (Hermes) to Kacific ERP

Kacific ERP exposes **one tool registry over three surfaces** — the in-app DeepSeek
agents, a REST API with an OpenAPI 3.1 document, and an MCP (Model Context Protocol)
endpoint. An external agent such as Hermes can therefore act as the conversational
interface between people and the ERP: *"how many Gigstarter kits are in Suva?"*,
*"what's the status of PO-2026-0012?"*, *"raise a PO for 50 LNBs to Manila"*,
*"approve PO-0017"* — without ever touching the database.

## 1. Mint an API key

Settings → **API keys** → *Create API key* (or `pnpm api-key "Hermes" procurement read:stock,read:po,write:po`).

Every key is bound to a **service-account user with a role** (so the normal RBAC
matrix applies) **and** to explicit scopes:

| Scope           | Grants                                                             |
| --------------- | ------------------------------------------------------------------ |
| `read:stock`    | SKUs, stock per depot, low-stock list                              |
| `read:vendors`  | Vendor list and profiles                                           |
| `read:po`       | Purchase orders, search, dashboard KPIs                            |
| `write:po`      | Create draft POs and submit them for approval                      |
| `approve:po`    | Approve / reject (key role must be `manager` or `admin`)           |
| `read:invoices` | Invoices and 3-way-match results                                   |
| `impersonate`   | Allows `X-On-Behalf-Of: <email>` to record the human requester     |

Keys look like `kfc_live_…`, are shown **once**, stored as SHA-256, can be revoked,
and are rate-limited to 60 requests/minute (120 for MCP). Every call is written to
the audit log with the key id.

## 2. REST

```bash
BASE=https://<your-deployment>/api/v1
KEY=kfc_live_…

# Discover
curl $BASE/openapi.json

# Identity
curl -H "Authorization: Bearer $KEY" $BASE/me

# Reads
curl -H "Authorization: Bearer $KEY" "$BASE/search?q=VSAT"
curl -H "Authorization: Bearer $KEY" "$BASE/skus/TRM-1200/stock"
curl -H "Authorization: Bearer $KEY" "$BASE/low-stock"
curl -H "Authorization: Bearer $KEY" "$BASE/purchase-orders?status=pending_approval"
curl -H "Authorization: Bearer $KEY" "$BASE/purchase-orders/PO-2026-0012"
curl -H "Authorization: Bearer $KEY" "$BASE/invoices/<id>"
curl -H "Authorization: Bearer $KEY" "$BASE/dashboard"

# Write: create a DRAFT, then submit (emails managers, creates the Asana task)
curl -X POST -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -H "X-On-Behalf-Of: requester@kacific.example" \
  -d '{"vendorId":"<vendor uuid>","warehouseCode":"SUV","neededBy":"2026-10-15",
       "notes":"Cyclone readiness","lines":[{"sku":"TRM-1200","qty":20},{"sku":"MNT-NPR","qty":20}]}' \
  $BASE/purchase-orders
curl -X POST -H "Authorization: Bearer $KEY" $BASE/purchase-orders/<id>/submit

# Approve / reject (approve:po + manager role)
curl -X POST -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"note":"OK for Q4 capex"}' $BASE/purchase-orders/<id>/approve
```

Every response uses the envelope `{ "data": …, "error": null | {code,message}, "meta": {} }`.
Status codes: `401` bad key, `403` missing scope / role, `409` illegal state transition,
`422` validation, `429` rate limit.

## 3. MCP (Streamable HTTP, stateless)

`POST /api/v1/mcp` speaks JSON-RPC 2.0 and supports `initialize`, `ping`, `tools/list`
and `tools/call`. Any MCP client can connect with the URL and the Bearer header:

```json
{
  "mcpServers": {
    "kacific-erp": {
      "url": "https://<your-deployment>/api/v1/mcp",
      "headers": { "Authorization": "Bearer kfc_live_…" }
    }
  }
}
```

Tools exposed (subject to the key's scopes): `search`, `get_low_stock`, `get_sku_stock`,
`list_skus`, `list_vendors`, `get_vendor`, `list_purchase_orders`, `get_purchase_order`,
`list_invoices`, `get_invoice`, `dashboard_summary`, `create_purchase_order`,
`submit_purchase_order`, `approve_purchase_order`, `reject_purchase_order`.

```bash
curl -X POST -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_sku_stock","arguments":{"sku":"TRM-1200"}}}' \
  https://<your-deployment>/api/v1/mcp
```

## 4. Suggested Hermes system prompt

```
You are the Kacific ERP assistant. You have tools that read live procurement data
(SKUs, stock per depot, purchase orders, vendors, invoices) and that can create,
submit, approve or reject purchase orders. Always read before you write. Quote SKU
codes and PO numbers exactly. Creating a PO makes a DRAFT — confirm with the user
before calling submit_purchase_order, and only approve when the user explicitly
asks and has the authority. Money is USD. Be concise.
```

## 5. Webhooks in the other direction

To be notified instead of polling, register an endpoint under Settings → **Webhooks**
(`po.submitted`, `po.approved`, `stock.low`, …). Deliveries are signed with
`X-Kacific-Signature: sha256=HMAC_SHA256(secret, timestamp + "." + body)`.
