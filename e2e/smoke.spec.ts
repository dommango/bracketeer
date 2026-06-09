import { test, expect } from "@playwright/test";

// Smoke coverage for the public, DB-free entry points. The authenticated pool
// screens (Home, Match Center, Match detail, Profile) are covered by unit tests
// on their pure selectors + the scripts/verify-features.ts backend e2e; these
// browser checks guard that the app boots and the join flow renders.

test("landing page renders the hero and join box", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /World Cup 2026 pool/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /have a join code/i })).toBeVisible();
});

test("sign-in page renders", async ({ page }) => {
  await page.goto("/signin");
  await expect(page.getByText(/sign in/i).first()).toBeVisible();
});

test("entering a join code routes to the pool", async ({ page }) => {
  await page.goto("/");
  const input = page.locator('input[name="code"]');
  await input.fill("FIXTUR");
  await input.press("Enter");
  await expect(page).toHaveURL(/\/pool\/FIXTUR/i);
});
