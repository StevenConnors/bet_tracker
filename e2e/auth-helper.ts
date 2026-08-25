import { expect, type Browser, type Page } from "@playwright/test";

const E2E_AUTH_SECRET = "stakeout-e2e-auth";

export async function authenticatePage(page: Page, email: string) {
  const response = await page.request.post("/api/test/auth", {
    data: { email },
    headers: { "x-e2e-auth-secret": E2E_AUTH_SECRET },
  });
  expect(response.status()).toBe(204);
}

export async function completeOnboarding(page: Page, name: string) {
  await expect(page.getByRole("heading", { name: "What should we call you?" })).toBeVisible();
  await expect(page).toHaveURL(/\/profile\?next=/);
  await page.getByLabel("Visible name").fill(name);
  await page.getByRole("button", { name: "Save and continue" }).click();
}

export async function signIn(browser: Browser, email: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await authenticatePage(page, email);
  await page.goto("/");
  await completeOnboarding(page, email);
  await expect(page.getByText("Keep the score.")).toBeVisible();
  return { context, page };
}
