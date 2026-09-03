import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { authenticateApiKey } from "@/server/services/api-keys";
import { rateLimit } from "@/server/security/rate-limit";
import { audit } from "@/server/services/audit";
import { runTool, TOOLS } from "@/server/agents/tools";
import { createPo, decidePo, getPo, submitPo } from "@/server/services/po";
import { getDb } from "@/db";
import { warehouses } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/* A minimal, stateless MCP server over Streamable HTTP (JSON-RPC 2.0). Enough
   for Hermes, Claude or any MCP client: initialize, ping, tools/list and
   tools/call. Auth and scopes are identical to the REST API. Write tools
   (create/submit/approve/reject) are added on top of the shared read registry. */
const rpc = (id: unknown, result?: unknown, error?: { code: number; message: string }) => NextResponse.json({ jsonrpc: "2.0", id: id ?? null, ...(error ? { error } : { result }) });

const WRITE_TOOLS = [
  { name: "create_purchase_order", scope: "write:po", description: "Create a DRAFT purchase order. lines: [{sku, qty, unitCost?}]. Returns the PO.", input: z.object({ vendorId: z.string().uuid(), warehouseCode: z.string().default("SIN-HQ"), neededBy: z.string().optional(), notes: z.string().optional(), lines: z.array(z.object({ sku: z.string(), qty: z.number().int().positive(), unitCost: z.number().optional() })).min(1) }) },
  { name: "submit_purchase_order", scope: "write:po", description: "Submit a draft PO for manager approval (emails one-click links, creates Asana task).", input: z.object({ idOrNumber: z.string() }) },
  { name: "approve_purchase_order", scope: "approve:po", description: "Approve a pending PO (key role must be manager/admin).", input: z.object({ idOrNumber: z.string(), note: z.string().optional() }) },
  { name: "reject_purchase_order", scope: "approve:po", description: "Reject a pending PO with a reason.", input: z.object({ idOrNumber: z.string(), note: z.string() }) },
] as const;

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const principal = auth.startsWith("Bearer ") ? await authenticateApiKey(auth.slice(7).trim()) : null;
  if (!principal) return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "Unauthorized: Bearer API key required" } }, { status: 401 });
  const rl = await rateLimit(`mcp:${principal.keyId}`, 120, 60_000);
  if (!rl.allowed) return rpc(null, undefined, { code: -32029, message: "Rate limited" });
  const body = (await req.json().catch(() => null)) as { id?: unknown; method?: string; params?: Record<string, unknown> } | null;
  if (!body?.method) return rpc(null, undefined, { code: -32600, message: "Invalid request" });
  const { id, method, params = {} } = body;

  switch (method) {
    case "initialize":
      return rpc(id, { protocolVersion: "2025-06-18", capabilities: { tools: { listChanged: false } }, serverInfo: { name: "kacific-erp", version: "1.0.0" }, instructions: "Kacific ERP procurement tools. Read tools return live data; write tools create/submit/approve purchase orders subject to the key's scopes and role." });
    case "notifications/initialized":
    case "ping":
      return rpc(id, {});
    case "tools/list": {
      const reads = TOOLS.filter((t) => !t.name.startsWith("propose_") && (!t.scope || principal.scopes.includes(t.scope))).map((t) => ({ name: t.name, description: t.description, inputSchema: z.toJSONSchema(t.input) }));
      const writes = WRITE_TOOLS.filter((t) => principal.scopes.includes(t.scope)).map((t) => ({ name: t.name, description: t.description, inputSchema: z.toJSONSchema(t.input) }));
      return rpc(id, { tools: [...reads, ...writes] });
    }
    case "tools/call": {
      const name = String(params.name ?? "");
      const args = (params.arguments ?? {}) as Record<string, unknown>;
      try {
        let result: unknown;
        const write = WRITE_TOOLS.find((t) => t.name === name);
        if (write) {
          if (!principal.scopes.includes(write.scope)) throw new Error(`Key lacks scope ${write.scope}`);
          const a = write.input.parse(args) as Record<string, unknown>;
          const actor = { type: "api_key" as const, id: principal.keyId, label: `MCP key ${principal.name}` };
          if (name === "create_purchase_order") {
            const db = getDb();
            const wh = await db.query.warehouses.findFirst({ where: eq(warehouses.code, String(a.warehouseCode)) });
            if (!wh) throw new Error("Unknown warehouse code");
            const lines = [];
            for (const l of a.lines as { sku: string; qty: number; unitCost?: number }[]) {
              const s = await db.query.skus.findFirst({ where: (x, { eq }) => eq(x.sku, l.sku.toUpperCase()) });
              if (!s) throw new Error(`Unknown SKU ${l.sku}`);
              lines.push({ skuId: s.id, description: s.name, qty: l.qty, unitCost: l.unitCost ?? s.unitCost });
            }
            const po = await createPo({ vendorId: String(a.vendorId), warehouseId: wh.id, neededBy: (a.neededBy as string) ?? null, notes: (a.notes as string) ?? "", source: "api", lines }, actor, principal.user.id);
            result = await runTool("get_purchase_order", { idOrNumber: po.id });
          } else {
            const po = await getPo(String(a.idOrNumber));
            if (!po) throw new Error("Purchase order not found");
            if (name === "submit_purchase_order") await submitPo(po.id, principal.user);
            else await decidePo(po.id, name === "approve_purchase_order" ? "approve" : "reject", { actor, role: principal.user.role, note: a.note as string | undefined, approverId: principal.user.id, via: "api" });
            result = await runTool("get_purchase_order", { idOrNumber: po.id });
          }
        } else {
          const tool = TOOLS.find((t) => t.name === name);
          if (!tool || tool.name.startsWith("propose_")) throw new Error(`Unknown tool ${name}`);
          if (tool.scope && !principal.scopes.includes(tool.scope)) throw new Error(`Key lacks scope ${tool.scope}`);
          result = await runTool(name, args);
        }
        await audit({ actor: { type: "api_key", id: principal.keyId, label: `MCP key ${principal.name}` }, action: "mcp.call", entityType: "api", entityId: name, payload: { args } });
        return rpc(id, { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], structuredContent: typeof result === "object" && result && !Array.isArray(result) ? result : { result }, isError: false });
      } catch (err) {
        return rpc(id, { content: [{ type: "text", text: err instanceof Error ? err.message : String(err) }], isError: true });
      }
    }
    default:
      return rpc(id, undefined, { code: -32601, message: `Method not found: ${method}` });
  }
}

export function GET() {
  return NextResponse.json({ error: "Use POST with JSON-RPC 2.0 (MCP Streamable HTTP, stateless)" }, { status: 405 });
}
