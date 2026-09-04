import { z } from "zod";
import { getDb } from "@/db";
import { skus } from "@/db/schema";
import { eq, ilike, or } from "drizzle-orm";
import { dueInvoices, getInvoice, listInvoices } from "@/server/services/invoice";
import { getPo, listPos } from "@/server/services/po";
import { getSku, listSkus, lowStockList } from "@/server/services/sku";
import { getVendor, listVendors } from "@/server/services/vendor";
import { dashboardData } from "@/server/services/dashboard";
import { INVOICE_STATUSES, PO_STATUSES, type ApiScope } from "@/lib/constants";
import type { ToolDef } from "@/server/integrations/deepseek";

/* ONE tool registry, three surfaces: the in-app DeepSeek agents, the REST
   /api/v1 endpoints and the MCP endpoint all execute these handlers. Every
   tool is read-only except propose_* which only returns a structured proposal
   for a human to apply. */
export type Tool<I extends z.ZodTypeAny = z.ZodTypeAny> = {
  name: string;
  description: string;
  scope: ApiScope | null;
  input: I;
  handler: (input: z.infer<I>) => Promise<unknown>;
};

const t = <I extends z.ZodTypeAny>(tool: Tool<I>) => tool as unknown as Tool;

export const TOOLS: Tool[] = [
  t({
    name: "search",
    description: "Search SKUs, purchase orders, vendors and invoices by free text (SKU code, PO number, vendor name, invoice number).",
    scope: "read:po",
    input: z.object({ q: z.string().min(1).max(100) }),
    handler: async ({ q }) => {
      const [s, p, v, i] = await Promise.all([listSkus({ q }), listPos({ q, limit: 20 }), listVendors({ q }), listInvoices({ q })]);
      return {
        skus: s.slice(0, 20).map((x) => ({ sku: x.sku, name: x.name, qty: x.qty, reorderLevel: x.reorderLevel, unitCost: x.unitCost, vendor: x.preferredVendor?.name })),
        purchaseOrders: p.map((x) => ({ id: x.id, poNumber: x.poNumber, status: x.status, vendor: x.vendor.name, total: x.total })),
        vendors: v.slice(0, 20).map((x) => ({ id: x.id, code: x.code, name: x.name, country: x.country, leadTimeDays: x.leadTimeDays })),
        invoices: i.slice(0, 20).map((x) => ({ id: x.id, invoiceNumber: x.invoiceNumber, status: x.status, vendor: x.vendor.name, total: x.total })),
      };
    },
  }),
  t({
    name: "get_low_stock",
    description: "List SKUs whose network-wide on-hand quantity is below the reorder level, with suggested reorder quantity and preferred vendor.",
    scope: "read:stock",
    input: z.object({ limit: z.number().int().min(1).max(100).optional() }),
    handler: async ({ limit }) => (await lowStockList()).slice(0, limit ?? 50).map(({ perWarehouse, ...l }) => ({ ...l, depots: perWarehouse.filter((w) => w.qty > 0) })),
  }),
  t({
    name: "get_sku_stock",
    description: "Stock position of one SKU: on hand per depot, on order, reorder level, preferred vendor and recent movements.",
    scope: "read:stock",
    input: z.object({ sku: z.string().min(1) }),
    handler: async ({ sku }) => {
      const s = await getSku(sku);
      if (!s) return { error: `SKU ${sku} not found` };
      return { sku: s.sku, name: s.name, category: s.category, unitCost: s.unitCost, qty: s.qty, onOrder: s.onOrder, reorderLevel: s.reorderLevel, reorderQty: s.reorderQty, leadTimeDays: s.leadTimeDays, preferredVendor: s.preferredVendor ? { id: s.preferredVendor.id, name: s.preferredVendor.name } : null, depots: s.stock.map((l) => ({ code: l.warehouse.code, name: l.warehouse.name, qty: l.qty })), openPos: s.openLines };
    },
  }),
  t({
    name: "list_skus",
    description: "List catalogue SKUs, optionally filtered by text or category.",
    scope: "read:stock",
    input: z.object({ q: z.string().optional(), category: z.string().optional() }),
    handler: async ({ q, category }) => (await listSkus({ q, category })).map((x) => ({ id: x.id, sku: x.sku, name: x.name, category: x.category, unit: x.unit, unitCost: x.unitCost, qty: x.qty, onOrder: x.onOrder, reorderLevel: x.reorderLevel, preferredVendorId: x.preferredVendorId, preferredVendor: x.preferredVendor?.name })),
  }),
  t({
    name: "list_vendors",
    description: "List active vendors with lead time, payment terms, rating and spend.",
    scope: "read:vendors",
    input: z.object({ q: z.string().optional() }),
    handler: async ({ q }) => (await listVendors({ q })).map((v) => ({ id: v.id, code: v.code, name: v.name, country: v.country, leadTimeDays: v.leadTimeDays, paymentTermsDays: v.paymentTermsDays, rating: v.rating, spend: v.spend, openPos: v.openPos, skuCount: v.skuCount })),
  }),
  t({
    name: "get_vendor",
    description: "Vendor profile with recent purchase orders, invoices and preferred SKUs.",
    scope: "read:vendors",
    input: z.object({ id: z.string() }),
    handler: async ({ id }) => {
      const v = await getVendor(id);
      if (!v) return { error: "Vendor not found" };
      return { id: v.id, code: v.code, name: v.name, country: v.country, leadTimeDays: v.leadTimeDays, paymentTermsDays: v.paymentTermsDays, rating: v.rating, spend: v.spend, disputedInvoices: v.disputed, notes: v.notes, recentPos: v.pos.slice(0, 10).map((p) => ({ poNumber: p.poNumber, status: p.status, total: p.total })), invoices: v.invoices.slice(0, 10).map((i) => ({ invoiceNumber: i.invoiceNumber, status: i.status, total: i.total })), skus: v.skus.map((s) => ({ sku: s.sku, name: s.name, unitCost: s.unitCost })) };
    },
  }),
  t({
    name: "list_purchase_orders",
    description: "List purchase orders, optionally filtered by status (draft, pending_approval, approved, rejected, ordered, received, closed, cancelled).",
    scope: "read:po",
    input: z.object({ status: z.enum(PO_STATUSES).optional(), limit: z.number().int().min(1).max(100).optional() }),
    handler: async ({ status, limit }) => (await listPos({ status, limit: limit ?? 50 })).map((p) => ({ id: p.id, poNumber: p.poNumber, status: p.status, vendor: p.vendor.name, warehouse: p.warehouse.code, requester: p.requester?.name, total: p.total, neededBy: p.neededBy, createdAt: p.createdAt })),
  }),
  t({
    name: "get_purchase_order",
    description: "Full purchase order by id or PO number, with lines and its event timeline.",
    scope: "read:po",
    input: z.object({ idOrNumber: z.string() }),
    handler: async ({ idOrNumber }) => {
      const po = await getPo(idOrNumber);
      if (!po) return { error: "Purchase order not found" };
      return { id: po.id, poNumber: po.poNumber, status: po.status, source: po.source, vendor: { id: po.vendorId, name: po.vendor.name }, warehouse: po.warehouse.code, requester: po.requester?.name, approver: po.approver?.name, total: po.total, neededBy: po.neededBy, notes: po.notes, submittedAt: po.submittedAt, decidedAt: po.decidedAt, decisionNote: po.decisionNote, lines: po.lines.map((l) => ({ sku: l.sku?.sku, description: l.description, qty: l.qty, qtyReceived: l.qtyReceived, unitCost: l.unitCost, lineTotal: l.lineTotal })), timeline: po.events.map((e) => ({ at: e.createdAt, type: e.type, by: e.actorLabel, message: e.message })), invoices: po.invoices.map((i) => ({ invoiceNumber: i.invoiceNumber, status: i.status, total: i.total })) };
    },
  }),
  t({
    name: "list_invoices",
    description: "List vendor invoices, optionally by status (draft, received, matched, approved, paid, disputed).",
    scope: "read:invoices",
    input: z.object({ status: z.enum(INVOICE_STATUSES).optional() }),
    handler: async ({ status }) => (await listInvoices({ status })).map((i) => ({ id: i.id, invoiceNumber: i.invoiceNumber, status: i.status, vendor: i.vendor.name, po: i.po?.poNumber, total: i.total, dueAt: i.dueAt, match: i.match })),
  }),
  t({
    name: "list_due_invoices",
    description: "Invoices due for payment now or within a number of days (status received/matched/approved with a due date on or before the horizon), oldest due first. Use for 'what is payable/pending'.",
    scope: "read:invoices",
    input: z.object({ days: z.number().int().min(1).max(90).optional() }),
    handler: async ({ days }) => (await dueInvoices(days ?? 7)).map((i) => ({ id: i.id, invoiceNumber: i.invoiceNumber, status: i.status, vendor: i.vendor.name, po: i.po?.poNumber, total: i.total, dueAt: i.dueAt, overdue: i.overdue })),
  }),
  t({
    name: "get_invoice",
    description: "Invoice detail with lines and 3-way match result.",
    scope: "read:invoices",
    input: z.object({ id: z.string() }),
    handler: async ({ id }) => {
      const i = await getInvoice(id);
      if (!i) return { error: "Invoice not found" };
      return { id: i.id, invoiceNumber: i.invoiceNumber, status: i.status, vendor: i.vendor.name, po: i.po?.poNumber, total: i.total, dueAt: i.dueAt, match: i.match, lines: i.lines.map((l) => ({ description: l.description, qty: l.qty, unitCost: l.unitCost, lineTotal: l.lineTotal })), notes: i.notes };
    },
  }),
  t({
    name: "dashboard_summary",
    description: "Headline KPIs: open POs, pending approvals, month-to-date spend, invoices due, low-stock count.",
    scope: "read:po",
    input: z.object({}),
    handler: async () => (await dashboardData()).kpis,
  }),
  t({
    name: "propose_purchase_order",
    description: "Return a structured purchase-order proposal for a human to review and apply. Use exact SKU codes and the preferred vendor's id. Does NOT create anything.",
    scope: "write:po",
    input: z.object({
      vendorId: z.string(),
      warehouseCode: z.string().default("SIN-HQ"),
      rationale: z.string(),
      neededBy: z.string().optional(),
      lines: z.array(z.object({ sku: z.string(), qty: z.number().int().positive(), reason: z.string().optional() })).min(1),
    }),
    handler: async (input) => {
      const db = getDb();
      const lines = [];
      for (const l of input.lines) {
        const s = await db.query.skus.findFirst({ where: or(eq(skus.sku, l.sku.toUpperCase()), ilike(skus.name, l.sku)) });
        lines.push(s ? { skuId: s.id, sku: s.sku, description: s.name, qty: l.qty, unitCost: s.unitCost, reason: l.reason ?? "" } : { skuId: null, sku: l.sku, description: l.sku, qty: l.qty, unitCost: 0, reason: `${l.reason ?? ""} (SKU not found)` });
      }
      return { proposal: { ...input, lines, total: lines.reduce((s, l) => s + l.qty * l.unitCost, 0) } };
    },
  }),
  t({
    name: "propose_invoice_match",
    description: "Return a proposed decision for an invoice (approve, dispute) with reasoning, for a human to apply.",
    scope: "read:invoices",
    input: z.object({ invoiceId: z.string(), decision: z.enum(["approve", "dispute", "hold"]), reasoning: z.string() }),
    handler: async (input) => ({ proposal: input }),
  }),
];

export function toolByName(name: string) {
  return TOOLS.find((x) => x.name === name);
}

export function toolDefs(names?: string[]): ToolDef[] {
  return TOOLS.filter((x) => !names || names.includes(x.name)).map((x) => ({
    type: "function",
    function: { name: x.name, description: x.description, parameters: z.toJSONSchema(x.input) as Record<string, unknown> },
  }));
}

export async function runTool(name: string, args: unknown) {
  const tool = toolByName(name);
  if (!tool) throw new Error(`Unknown tool ${name}`);
  const parsed = tool.input.safeParse(args ?? {});
  if (!parsed.success) return { error: "Invalid arguments", issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  return tool.handler(parsed.data);
}
