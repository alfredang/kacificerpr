import { expect, type Page } from "@playwright/test";

export const ACCOUNTS = {
  admin: { email: "admin1@kacific.com", password: "admin12345" },
  manager: { email: "manager@kacific.example", password: "Kacific2026!" },
  requester: { email: "requester@kacific.example", password: "Kacific2026!" },
  finance: { email: "finance@kacific.example", password: "Kacific2026!" },
  viewer: { email: "viewer@kacific.example", password: "Kacific2026!" },
  sales: { email: "sales@kacific.com", password: "admin12345" },
};

export async function login(page: Page, who: keyof typeof ACCOUNTS) {
  await page.goto("/login");
  await page.getByLabel("Work email").fill(ACCOUNTS[who].email);
  await page.getByLabel("Password").fill(ACCOUNTS[who].password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard|\/purchase-orders/);
}

export async function logout(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
}

/* Reads the newest email link matching `pattern` from the dev outbox. */
export async function latestMailLink(page: Page, subject: RegExp, pattern: RegExp) {
  await page.goto("/dev/mailbox");
  const mail = page.locator('[data-testid="mail"]').filter({ hasText: subject }).first();
  await expect(mail).toBeVisible();
  const links = await mail.locator("a").allTextContents();
  const hit = links.find((l) => pattern.test(l));
  if (!hit) throw new Error(`No link matching ${pattern} in "${await mail.textContent()}"`);
  return hit;
}
