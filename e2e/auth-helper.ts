import { expect, type Browser, type Page } from "@playwright/test";

const E2E_AUTH_SECRET = "stakeout-e2e-auth";

export async function authenticatePage(page: Page, email: string) {
  const response = await page.request.post("/api/test/auth", {
    data: { email },
    headers: { "x-e2e-auth-secret": E2E_AUTH_SECRET },
  });
  expect(response.status()).toBe(204);
}

export function testUsername(value: string) {
  const stem = value.toLowerCase().replace(/@.*$/, "").replace(/[^a-z0-9_]/g, "_").slice(0, 14) || "user";
  let hash = 0;
  for (const character of value) hash = ((hash * 31) + character.charCodeAt(0)) >>> 0;
  return `${stem}_${hash.toString(36)}`.slice(0, 24);
}

export async function completeOnboarding(page: Page, name: string, username = testUsername(name)) {
  await expect(page.getByRole("heading", { name: "Set up your profile." })).toBeVisible();
  await expect(page).toHaveURL(/\/profile\?next=/);
  await page.getByLabel("Visible name").fill(name);
  await page.getByLabel("Username").fill(username);
  await page.getByRole("button", { name: "Save and continue" }).click();
}

export async function signIn(browser: Browser, email: string, profile: { name?: string; username?: string } = {}) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await authenticatePage(page, email);
  await page.goto("/");
  await completeOnboarding(page, profile.name || email, profile.username || testUsername(email));
  await expect(page.getByText("Keep the score.")).toBeVisible();
  return { context, page };
}
