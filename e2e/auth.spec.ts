import { expect, test } from "@playwright/test";
import { authenticatePage } from "./auth-helper";

test("protected pages redirect signed-out visitors without exposing content", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText("Keep the score.")).toHaveCount(0);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText("Admin control.")).toHaveCount(0);
});

test("login starts Google OAuth with a safe callback destination", async ({ page }) => {
  await page.goto("/login?next=%2Fbets%2F000000000000000000000000");
  const authorization = page.waitForRequest(request => request.url().includes("/auth/v1/authorize"));
  await page.getByRole("button", { name: "Continue with Google" }).click();
  const url = new URL((await authorization).url());
  expect(url.searchParams.get("provider")).toBe("google");
  expect(url.searchParams.get("redirect_to")).toBe("http://127.0.0.1:3100/auth/callback?next=%2Fbets%2F000000000000000000000000");
});

test("a failed OAuth callback returns to a generic login error", async ({ page }) => {
  await page.goto("/auth/callback?next=https%3A%2F%2Fevil.example%2Fsteal");
  await expect(page).toHaveURL(/\/login\?error=oauth$/);
  await expect(page.locator(".error[role=alert]")).toHaveText("Google sign-in was cancelled or could not be completed.");
});

test("an authenticated session persists across refresh and signs out", async ({ page }) => {
  const email = `oauth-${Date.now()}@example.test`;
  await authenticatePage(page, email);
  await page.goto("/");
  await expect(page.getByText("Keep the score.")).toBeVisible();
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Keep the score.")).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});

test("authenticated visitors are redirected away from login", async ({ page }) => {
  await authenticatePage(page, `already-signed-in-${Date.now()}@example.test`);
  await page.goto("/login");
  await expect(page).toHaveURL("http://127.0.0.1:3100/");
});

test("Google login remains keyboard-usable without horizontal overflow on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeFocused();
  const dimensions = await page.evaluate(() => ({ documentWidth: document.documentElement.scrollWidth, viewportWidth: window.innerWidth }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeInViewport();
});
