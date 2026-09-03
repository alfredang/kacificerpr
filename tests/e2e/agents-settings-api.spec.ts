import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test("agent proposes a reorder in mock mode and a human applies it", async ({ page }) => {
  await login(page, "admin");
  await page.goto("/agents");
  const card = page.locator("form").filter({ hasText: "Reorder recommendations" });
  await card.getByRole("button", { name: /Run reorder review/ }).click();
  await expect(card.getByText(/Done — review/)).toBeVisible({ timeout: 30_000 });
  const run = page.locator("li").filter({ hasText: "proposed" }).first();
  await expect(run).toBeVisible();
  await run.getByRole("button", { name: "Apply as draft PO" }).click();
  await expect(page).toHaveURL(/\/purchase-orders\/[0-9a-f-]{36}$/);
  await expect(page.getByText("Draft").first()).toBeVisible();
  await expect(page.getByText(/Agent proposal/)).toBeVisible();
});

test("Hermes widget answers from live data", async ({ page }) => {
  await login(page, "admin");
  await page.getByRole("button", { name: "Open Hermes chat" }).click();
  await page.getByLabel("Message Hermes").fill("How many purchase orders are open?");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.locator('[data-testid="hermes-widget"]').getByText(/\[mock\]|openPos/).last()).toBeVisible({ timeout: 30_000 });
});

test("admin creates an API key and the external API answers with it", async ({ page, request }) => {
  await login(page, "admin");
  await page.goto("/settings/api-keys");
  await page.getByLabel("Key name").fill("e2e key");
  await page.getByRole("button", { name: "Create API key" }).click();
  const key = (await page.locator('[data-testid="secret"]').textContent())!.trim();
  expect(key).toMatch(/^kfc_live_/);
  const me = await request.get("/api/v1/me", { headers: { authorization: `Bearer ${key}` } });
  expect(me.ok()).toBeTruthy();
  const low = await request.get("/api/v1/low-stock", { headers: { authorization: `Bearer ${key}` } });
  expect((await low.json()).data.length).toBeGreaterThan(0);
  const denied = await request.post("/api/v1/purchase-orders", { headers: { authorization: `Bearer ${key}` }, data: {} });
  expect(denied.status()).toBe(403); // default scopes are read-only
  const anon = await request.get("/api/v1/low-stock");
  expect(anon.status()).toBe(401);
  const mcp = await request.post("/api/v1/mcp", { headers: { authorization: `Bearer ${key}` }, data: { jsonrpc: "2.0", id: 1, method: "tools/list" } });
  expect((await mcp.json()).result.tools.map((t: { name: string }) => t.name)).toContain("get_low_stock");
});

test("scheduled task runs on demand and the cron endpoint is protected", async ({ page, request }) => {
  await login(page, "admin");
  await page.goto("/settings/scheduled-tasks");
  await page.getByRole("button", { name: "Run now" }).first().click();
  await expect(page.getByText(/low-stock SKUs|above reorder level/).first()).toBeVisible({ timeout: 20_000 });
  expect((await request.get("/api/cron/tick")).status()).toBe(401);
});

test("security headers are present", async ({ request }) => {
  const res = await request.get("/login");
  expect(res.headers()["x-frame-options"]).toBe("DENY");
  expect(res.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(res.headers()["strict-transport-security"]).toContain("max-age");
});
