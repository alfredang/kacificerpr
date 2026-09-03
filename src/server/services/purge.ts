import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { audit, type Actor } from "./audit";

/* Removes the demo dataset (vendors, SKUs + stock, purchase orders, invoices and
   everything hanging off them) so real data can be entered. People, company
   settings, integrations, API keys, scheduled tasks and webhook endpoints are
   kept. Runs in one transaction; every step is audited. */
export async function purgeDemoData(actor: Actor) {
  const db = getDb();
  const counts = await db.transaction(async (tx) => {
    const before = {
      purchaseOrders: await tx.$count(s.purchaseOrders),
      invoices: await tx.$count(s.invoices),
      skus: await tx.$count(s.skus),
      vendors: await tx.$count(s.vendors),
    };
    await tx.delete(s.chatMessages);
    await tx.delete(s.agentRuns);
    await tx.delete(s.asanaTasks);
    await tx.delete(s.webhookDeliveries);
    await tx.delete(s.inboundWebhooks);
    await tx.delete(s.oneTimeTokens).where(sql`${s.oneTimeTokens.poId} is not null`);
    await tx.delete(s.invoiceLines);
    await tx.delete(s.invoices);
    await tx.delete(s.poEvents);
    await tx.delete(s.purchaseOrderLines);
    await tx.delete(s.purchaseOrders);
    await tx.delete(s.stockMovements);
    await tx.delete(s.stockLevels);
    await tx.delete(s.skus);
    await tx.delete(s.vendors);
    await tx.delete(s.emailOutbox);
    await tx.update(s.companySettings).set({ nextPoSeq: 1 });
    return before;
  });
  await audit({ actor, action: "data.purge_demo", entityType: "database", payload: counts });
  return counts;
}
