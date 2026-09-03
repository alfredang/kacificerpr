import { describe, expect, it } from "vitest";
import { ACTIONS, can } from "@/server/auth/rbac";

describe("RBAC matrix", () => {
  it("admin can do everything", () => {
    for (const a of ACTIONS) expect(can("admin", a)).toBe(true);
  });
  it("viewer is read-only", () => {
    expect(can("viewer", "po.view")).toBe(true);
    expect(can("viewer", "po.create")).toBe(false);
    expect(can("viewer", "settings.manage")).toBe(false);
  });
  it("only admin manages settings and users", () => {
    expect(can("manager", "settings.manage")).toBe(false);
    expect(can("finance", "users.manage")).toBe(false);
  });
  it("separation of duties: requester cannot approve, finance cannot order", () => {
    expect(can("requester", "po.approve")).toBe(false);
    expect(can("finance", "po.order")).toBe(false);
    expect(can("procurement", "po.approve")).toBe(false);
  });
});
