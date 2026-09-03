import { describe, expect, it } from "vitest";
import { computeMatch } from "@/server/services/invoice";

type Inv = Parameters<typeof computeMatch>[0];

function fixture(over: Partial<{ invQty: number; invPrice: number; received: number; vendorId: string }> = {}) {
  const poLine = { id: "l1", poId: "po1", lineNo: 1, skuId: "sku1", description: "Gigstarter 1.2 m terminal", qty: 10, unitCost: 1850, lineTotal: 18500, qtyReceived: over.received ?? 10, sku: null };
  const inv = {
    id: "inv1",
    vendorId: over.vendorId ?? "v1",
    total: (over.invQty ?? 10) * (over.invPrice ?? 1850),
    lines: [{ id: "il1", invoiceId: "inv1", skuId: "sku1", description: "Gigstarter 1.2 m terminal", qty: over.invQty ?? 10, unitCost: over.invPrice ?? 1850, lineTotal: (over.invQty ?? 10) * (over.invPrice ?? 1850), sku: null }],
    po: { id: "po1", vendorId: "v1", total: 18500, lines: [poLine] },
  } as unknown as Inv;
  return inv;
}

describe("3-way match", () => {
  it("passes when PO, receipt and price agree", async () => {
    const m = await computeMatch(fixture(), 2);
    expect(m).toMatchObject({ poMatch: true, qtyMatch: true, receiptMatch: true, priceMatch: true, variance: 0 });
    expect(m.notes).toEqual([]);
  });
  it("flags quantity above the PO and above receipt", async () => {
    const m = await computeMatch(fixture({ invQty: 12 }), 2);
    expect(m.qtyMatch).toBe(false);
    expect(m.receiptMatch).toBe(false);
    expect(m.variance).toBe(3700);
  });
  it("flags invoiced-before-received", async () => {
    const m = await computeMatch(fixture({ received: 4 }), 2);
    expect(m.qtyMatch).toBe(true);
    expect(m.receiptMatch).toBe(false);
  });
  it("respects the price tolerance", async () => {
    expect((await computeMatch(fixture({ invPrice: 1880 }), 2)).priceMatch).toBe(true); // 1.6 %
    expect((await computeMatch(fixture({ invPrice: 1998 }), 2)).priceMatch).toBe(false); // 8 %
    expect((await computeMatch(fixture({ invPrice: 1998 }), 10)).priceMatch).toBe(true);
  });
  it("fails PO match when the vendor differs or no PO is linked", async () => {
    expect((await computeMatch(fixture({ vendorId: "other" }), 2)).poMatch).toBe(false);
    const noPo = { ...fixture(), po: null } as unknown as Inv;
    const m = await computeMatch(noPo, 2);
    expect(m.poMatch).toBe(false);
    expect(m.notes[0]).toMatch(/No purchase order/);
  });
});
