import { expect, test } from "@playwright/test";

import { hasTestUser, signIn, testUser, waitForAuthForm } from "./helpers";

test.describe("authentication", () => {
  test("login page renders the sign-in form and Google option", async ({ page }) => {
    await page.goto("/login");
    await waitForAuthForm(page);
    await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /^sign in$/i })).toBeVisible();
    // Google OAuth itself cannot be automated (Google blocks headless consent),
    // so E2E only asserts the entry point exists; the handler is unit-tested.
    await expect(page.getByRole("button", { name: /continue with google/i })).toBeVisible();
  });

  test("rejects invalid credentials with a visible error", async ({ page }) => {
    await page.goto("/login");
    await waitForAuthForm(page);
    await page.getByLabel("Email", { exact: true }).fill("nobody@darukaa.earth");
    await page.getByLabel("Password", { exact: true }).fill("wrong-password");
    await page.getByRole("button", { name: /^sign in$/i }).click();

    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("protected routes redirect anonymous visitors to the login page", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });
    await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  });

  test.describe("with a seeded test account", () => {
    test.skip(!hasTestUser, "E2E_TEST_EMAIL / E2E_TEST_PASSWORD are not configured");

    test("signs in with valid credentials", async ({ page }) => {
      await signIn(page);
      await expect(page.getByRole("main")).toBeVisible();
    });

    test("keeps the session across a page reload", async ({ page }) => {
      await signIn(page);
      await page.reload();
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(page.getByLabel("Email", { exact: true })).toHaveCount(0);
    });

    test("signs out and blocks the protected route afterwards", async ({ page }) => {
      await signIn(page);

      const profile = page.getByRole("button", {
        name: new RegExp(testUser.email.split("@")[0]!, "i"),
      });
      if (await profile.isVisible().catch(() => false)) {
        await profile.click();
      } else {
        await page.getByRole("button", { name: /menu/i }).first().click();
      }
      await page.getByRole("button", { name: /sign out/i }).click();

      await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });
      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });
    });
  });
});
