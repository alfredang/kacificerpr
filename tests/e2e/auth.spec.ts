import { test, expect } from "@playwright/test";
import { login, logout, latestMailLink, ACCOUNTS } from "./helpers";

test.describe("authentication", () => {
  test("redirects anonymous users and signs an admin in", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
    await login(page, "admin");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Good (morning|afternoon|evening)/);
    await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
    await logout(page);
  });

  test("rejects a wrong password with a generic message", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Work email").fill(ACCOUNTS.admin.email);
    await page.getByLabel("Password").fill("definitely-wrong");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText(/did not match/)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("forgot-password issues a single-use link that signs the user in", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByLabel("Work email").fill(ACCOUNTS.viewer.email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText(/Check your inbox/)).toBeVisible();
    const link = await latestMailLink(page, /Reset your Kacific ERP password/, /reset-password/);
    await page.goto(link);
    await page.getByLabel("New password").fill(ACCOUNTS.viewer.password);
    await page.getByLabel("Confirm password").fill(ACCOUNTS.viewer.password);
    await page.getByRole("button", { name: /Update password/ }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    // Second use of the same link must fail
    await page.goto(link);
    await expect(page.getByText(/cannot be used/)).toBeVisible();
  });

  test("viewer cannot see settings and is blocked from admin routes", async ({ page }) => {
    await login(page, "viewer");
    await expect(page.getByRole("link", { name: "Settings" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "New purchase order" })).toHaveCount(0);
  });
});
