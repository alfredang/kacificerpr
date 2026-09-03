import { describe, expect, it } from "vitest";
import { allowedActions, poTotals, stageIndex, transition } from "@/lib/po-status";

describe("PO state machine", () => {
  it("follows the happy path", () => {
    expect(transition("draft", "submit")).toBe("pending_approval");
    expect(transition("pending_approval", "approve")).toBe("approved");
    expect(transition("approved", "order")).toBe("ordered");
    expect(transition("ordered", "receive")).toBe("received");
    expect(transition("received", "close")).toBe("closed");
  });
  it("rejects illegal moves", () => {
    expect(transition("draft", "approve")).toBeNull();
    expect(transition("closed", "cancel")).toBeNull();
    expect(transition("cancelled", "reopen")).toBeNull();
  });
  it("only managers/admins approve", () => {
    expect(allowedActions("pending_approval", "manager")).toContain("approve");
    expect(allowedActions("pending_approval", "requester")).not.toContain("approve");
    expect(allowedActions("pending_approval", "viewer")).toEqual([]);
  });
  it("computes totals to cents", () => {
    expect(poTotals([{ qty: 3, unitCost: 19.99 }], 0)).toEqual({ subtotal: 59.97, tax: 0, total: 59.97 });
    expect(poTotals([{ qty: 2, unitCost: 100 }], 0.09)).toEqual({ subtotal: 200, tax: 18, total: 218 });
  });
  it("maps statuses onto stepper stages", () => {
    expect(stageIndex("draft")).toBe(0);
    expect(stageIndex("rejected")).toBe(1);
    expect(stageIndex("closed")).toBe(5);
    expect(stageIndex("cancelled")).toBe(-1);
  });
});
