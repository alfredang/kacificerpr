import { NextResponse } from "next/server";
import { z } from "zod";
import { TOOLS } from "@/server/agents/tools";

export const dynamic = "force-dynamic";

/* OpenAPI 3.1 document for the Hermes / external-agent API. Read endpoints
   are generated from the shared tool registry so the spec cannot drift. */
export function GET() {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const envelope = (dataSchema: Record<string, unknown>) => ({
    type: "object",
    properties: { data: dataSchema, error: { type: ["object", "null"], properties: { code: { type: "string" }, message: { type: "string" } } }, meta: { type: "object" } },
  });
  const tool = (name: string) => TOOLS.find((t) => t.name === name)!;
  const paramsFrom = (name: string, path: string[] = []) => {
    const schema = z.toJSONSchema(tool(name).input) as { properties?: Record<string, unknown>; required?: string[] };
    return Object.entries(schema.properties ?? {}).map(([k, v]) => ({ name: k, in: path.includes(k) ? "path" : "query", required: path.includes(k) || (schema.required ?? []).includes(k), schema: v }));
  };
  const get = (summary: string, toolName: string, scope: string, pathParams: string[] = []) => ({
    get: { summary, description: tool(toolName).description, security: [{ bearer: [] }], "x-scope": scope, parameters: paramsFrom(toolName, pathParams), responses: { "200": { description: "OK", content: { "application/json": { schema: envelope({}) } } }, "401": { description: "Missing or invalid key" }, "403": { description: "Missing scope" }, "429": { description: "Rate limited (60/min)" } } },
  });
  const doc = {
    openapi: "3.1.0",
    info: { title: "Kacific ERP external API", version: "1.0.0", description: "REST surface for external agents (e.g. Hermes). Authenticate with `Authorization: Bearer kfc_live_…`. Keys are scoped and bound to a service-account role. The same tools are available over MCP at POST /api/v1/mcp." },
    servers: [{ url: `${base}/api/v1` }],
    components: { securitySchemes: { bearer: { type: "http", scheme: "bearer" } } },
    paths: {
      "/me": { get: { summary: "Identify the key", security: [{ bearer: [] }], responses: { "200": { description: "OK" } } } },
      "/search": get("Free-text search", "search", "read:po"),
      "/dashboard": get("Headline KPIs", "dashboard_summary", "read:po"),
      "/skus": get("List SKUs", "list_skus", "read:stock"),
      "/skus/{sku}": get("SKU stock position", "get_sku_stock", "read:stock", ["sku"]),
      "/skus/{sku}/stock": get("SKU stock position (alias)", "get_sku_stock", "read:stock", ["sku"]),
      "/low-stock": get("SKUs below reorder level", "get_low_stock", "read:stock"),
      "/vendors": get("List vendors", "list_vendors", "read:vendors"),
      "/vendors/{id}": get("Vendor detail", "get_vendor", "read:vendors", ["id"]),
      "/invoices": get("List invoices", "list_invoices", "read:invoices"),
      "/invoices/{id}": get("Invoice detail with 3-way match", "get_invoice", "read:invoices", ["id"]),
      "/purchase-orders": {
        ...get("List purchase orders", "list_purchase_orders", "read:po"),
        post: {
          summary: "Create a DRAFT purchase order",
          security: [{ bearer: [] }],
          "x-scope": "write:po",
          description: "Creates a draft. Call /purchase-orders/{id}/submit to route it for approval. Optional header X-On-Behalf-Of: <user email> (needs the impersonate scope) records the human requester.",
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["vendorId", "lines"], properties: { vendorId: { type: "string", format: "uuid" }, warehouseCode: { type: "string", default: "SIN-HQ" }, neededBy: { type: "string", format: "date" }, notes: { type: "string" }, lines: { type: "array", items: { type: "object", required: ["qty"], properties: { sku: { type: "string" }, skuId: { type: "string" }, description: { type: "string" }, qty: { type: "integer" }, unitCost: { type: "number" } } } } } } } } },
          responses: { "201": { description: "Created" }, "422": { description: "Validation error" } },
        },
      },
      "/purchase-orders/{idOrNumber}": get("Purchase order detail with timeline", "get_purchase_order", "read:po", ["idOrNumber"]),
      "/purchase-orders/{id}/submit": { post: { summary: "Submit for approval (emails managers, creates Asana task)", security: [{ bearer: [] }], "x-scope": "write:po", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Submitted" }, "409": { description: "Illegal transition" } } } },
      "/purchase-orders/{id}/approve": { post: { summary: "Approve (key role must be manager/admin)", security: [{ bearer: [] }], "x-scope": "approve:po", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], requestBody: { content: { "application/json": { schema: { type: "object", properties: { note: { type: "string" } } } } } }, responses: { "200": { description: "Approved" } } } },
      "/purchase-orders/{id}/reject": { post: { summary: "Reject", security: [{ bearer: [] }], "x-scope": "approve:po", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], requestBody: { content: { "application/json": { schema: { type: "object", required: ["note"], properties: { note: { type: "string" } } } } } }, responses: { "200": { description: "Rejected" } } } },
      "/mcp": { post: { summary: "MCP Streamable-HTTP endpoint (JSON-RPC 2.0: initialize, tools/list, tools/call)", security: [{ bearer: [] }], responses: { "200": { description: "JSON-RPC response" } } } },
    },
  };
  return NextResponse.json(doc);
}
