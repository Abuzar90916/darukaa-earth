import { expect, type Page } from "@playwright/test";

/**
 * Credentials come from the environment only — never hardcode a real account.
 * See .env.test.example for the variables CI and local runs expect.
 */
export const testUser = {
  email: process.env["E2E_TEST_EMAIL"] ?? "",
  password: process.env["E2E_TEST_PASSWORD"] ?? "",
};

export const hasTestUser = Boolean(testUser.email && testUser.password);

/** Unique suffix so parallel/repeat runs never collide on names. */
export function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Waits until React has hydrated the auth form, so clicks are handled in-app. */
export async function waitForAuthForm(page: Page): Promise<void> {
  await expect(page.locator('form[data-hydrated="true"]')).toBeVisible({ timeout: 30_000 });
}

export async function signIn(page: Page): Promise<void> {
  await page.goto("/login");
  await waitForAuthForm(page);
  await page.getByLabel("Email", { exact: true }).fill(testUser.email);
  await page.getByLabel("Password", { exact: true }).fill(testUser.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
}

export async function openNav(page: Page): Promise<void> {
  const menuButton = page.getByRole("button", { name: /open menu|menu/i }).first();
  if (await menuButton.isVisible().catch(() => false)) await menuButton.click();
}
