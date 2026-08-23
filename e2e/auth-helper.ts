import { expect, type Browser, type Page } from "@playwright/test";

const E2E_AUTH_SECRET = "stakeout-e2e-auth";

export async function authenticatePage(page: Page, email: string) {
  const response = await page.request.post("/api/test/auth", {
    data: { email },
    headers: { "x-e2e-auth-secret": E2E_AUTH_SECRET },
  });
  expect(response.status()).toBe(204);
}

export async function signIn(browser: Browser, email: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await authenticatePage(page, email);
  await page.goto("/");
  await expect(page.getByText("Keep the score.")).toBeVisible();
  return { context, page };
}
