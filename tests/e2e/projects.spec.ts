import { expect, test } from "@playwright/test";

import { hasTestUser, signIn, uniqueName } from "./helpers";

test.describe("projects, sites and analytics", () => {
  test.skip(!hasTestUser, "E2E_TEST_EMAIL / E2E_TEST_PASSWORD are not configured");

  test("creates a project and opens its detail page", async ({ page }) => {
    await signIn(page);
    const name = uniqueName("E2E Mangrove");

    await page.goto("/projects");
    await page
      .getByRole("button", { name: /new project/i })
      .first()
      .click();
    await page.getByLabel(/name/i).fill(name);
    const description = page.getByLabel(/description/i);
    if (await description.isVisible().catch(() => false)) {
      await description.fill("Created by the automated end-to-end suite.");
    }
    await page
      .getByRole("button", { name: /create|save/i })
      .last()
      .click();

    await expect(page.getByText(name).first()).toBeVisible({ timeout: 30_000 });
    await page.getByText(name).first().click();
    await expect(page).toHaveURL(/\/projects\//);
    await expect(page.getByRole("heading", { name })).toBeVisible();
  });

  test("shows site boundaries and analytics for a seeded site", async ({ page }) => {
    await signIn(page);
    await page.goto("/sites");

    const firstSite = page.getByRole("link").filter({ hasText: /./ }).first();
    await expect(firstSite).toBeVisible({ timeout: 30_000 });
    await firstSite.click();

    await expect(page).toHaveURL(/\/sites\//);
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/hectares|ha\b/i).first()).toBeVisible();
  });

  test("analytics page renders charts with data", async ({ page }) => {
    await signIn(page);
    await page.goto("/analytics");
    await expect(page.locator("svg .recharts-surface, .recharts-surface").first()).toBeVisible({
      timeout: 30_000,
    });
  });

  test("has no horizontal overflow on mobile viewports", async ({ page }) => {
    await signIn(page);
    await page.goto("/dashboard");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
