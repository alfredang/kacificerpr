import { test, expect } from "@playwright/test";
import { login, logout, latestMailLink } from "./helpers";

test.describe.serial("procure to pay", () => {
  let poNumber = "";

  test("requester raises and submits a PO with suggested low-stock lines", async ({ page }) => {
    await login(page, "requester");
    await page.goto("/purchase-orders/new");
    await page.getByLabel("Vendor").selectOption({ label: "SkyBridge RF Pty Ltd (V-SKY)" });
    await page.getByLabel("Deliver to depot").selectOption({ label: "Manila Hub (MNL)" });
    const suggest = page.getByRole("button", { name: /Suggest \d+ low-stock/ });
    if (await suggest.isVisible()) await suggest.click();
    const rows = page.locator("tbody tr");
    await rows.first().getByLabel("SKU").selectOption({ label: "RF-LNB" });
    await rows.first().getByLabel("Quantity").fill("25");
    await page.getByLabel("Notes for the approver").fill("e2e: LNB replenishment for Manila installs");
    await page.getByRole("button", { name: /Save & submit for approval/ }).click();
    await expect(page).toHaveURL(/\/purchase-orders\/[0-9a-f-]{36}$/);
    await expect(page.getByText("Pending approval").first()).toBeVisible();
    poNumber = (await page.getByRole("heading", { level: 1 }).textContent())!.match(/PO-\d{4}-\d{4}/)![0];
    await expect(page.getByText("approval email sent")).toBeVisible();
    await logout(page);
  });

  test("manager approves through the emailed one-click link", async ({ page }) => {
    const link = await latestMailLink(page, new RegExp(`Approval needed: ${poNumber}`), /approvals\//);
    await page.goto(link);
    await expect(page.getByRole("heading", { name: new RegExp(`Approve ${poNumber}`) })).toBeVisible();
    await page.getByRole("button", { name: /Confirm approval/ }).click();
    await expect(page.getByRole("heading", { name: new RegExp(`${poNumber} approved`) })).toBeVisible();
    // The link is single-use
    await page.goto(link);
    await expect(page.getByText(/cannot be used/)).toBeVisible();
  });

  test("procurement orders and receives, stock moves, finance records and matches an invoice", async ({ page }) => {
    await login(page, "admin");
    await page.goto(`/purchase-orders/${poNumber}`);
    await expect(page.getByText("Approved").first()).toBeVisible();
    await page.getByRole("button", { name: "Mark as ordered" }).click();
    await page.getByRole("button", { name: /Confirm mark as ordered/ }).click();
    await expect(page.getByText("Ordered").first()).toBeVisible();
    await page.getByRole("button", { name: "Receive goods" }).click();
    await page.getByRole("button", { name: /Confirm receive goods/ }).click();
    await expect(page.getByText("Received").first()).toBeVisible();
    await expect(page.locator("text=received").first()).toBeVisible();

    await page.getByRole("link", { name: "Record invoice" }).click();
    await expect(page).toHaveURL(/\/invoices\/new\?po=/);
    await page.getByLabel("Vendor invoice number").fill(`E2E-${Date.now()}`);
    await page.getByRole("button", { name: /Record invoice/ }).click();
    await expect(page).toHaveURL(/\/invoices\/[0-9a-f-]{36}$/);
    await expect(page.getByText("Matched").first()).toBeVisible();
    await page.getByRole("button", { name: "Approve for payment" }).click();
    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByText("Approved").first()).toBeVisible();
    await page.getByRole("button", { name: "Mark as paid" }).click();
    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByText("Paid").first()).toBeVisible();
  });
});
