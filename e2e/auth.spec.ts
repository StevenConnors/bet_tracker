import { expect, test, type Page } from "@playwright/test";

type MessageSummary = { ID: string; Subject?: string; To?: { Address: string }[] };

async function messageIds(email: string) {
  const list = await fetch("http://127.0.0.1:54324/api/v1/messages").then(response => response.json());
  return new Set<string>((list.messages || []).filter((item: MessageSummary) => item.To?.some(to => to.Address === email)).map((item: MessageSummary) => item.ID));
}

async function signInMessage(email: string, existing: Set<string>) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const list = await fetch("http://127.0.0.1:54324/api/v1/messages").then(response => response.json());
    const summary = list.messages?.find((item: MessageSummary) => !existing.has(item.ID) && item.Subject === "Your Stakeout sign-in code" && item.To?.some(to => to.Address === email));
    if (summary?.ID) return fetch(`http://127.0.0.1:54324/api/v1/message/${summary.ID}`).then(response => response.json());
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`No sign-in email received for ${email}`);
}

async function requestCode(page: Page, email: string, next = "/") {
  const existing = await messageIds(email);
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Send my sign-in code" }).click();
  return signInMessage(email.trim().toLowerCase(), existing);
}

function messageBody(message: { HTML?: string; Text?: string }) {
  return `${message.HTML || ""}\n${message.Text || ""}`.replace(/&amp;/g, "&");
}

async function completeOnboarding(page: Page, name: string) {
  await expect(page.getByRole("heading", { name: "What should we call you?" })).toBeVisible();
  await expect(page).toHaveURL(/\/profile\?next=/);
  await page.getByLabel("Visible name").fill(name);
  await page.getByRole("button", { name: "Save and continue" }).click();
}

test("protected pages redirect signed-out visitors without exposing content", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText("Keep the score.")).toHaveCount(0);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText("Admin control.")).toHaveCount(0);
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/login\?next=%2Fprofile$/);
  await expect(page.getByText("Make it yours.")).toHaveCount(0);
});

test("the OTP form constrains input and rejects an invalid code generically", async ({ page }) => {
  await page.goto("/login/verify");
  const code = page.getByLabel("Six-digit code");
  const submit = page.getByRole("button", { name: "Sign in" });
  await expect(submit).toBeDisabled();
  await code.fill("12ab34");
  await expect(code).toHaveValue("1234");
  await code.fill("12345678");
  await expect(code).toHaveValue("123456");
  await page.getByLabel("Email address").fill("invalid-code@example.test");
  await submit.click();
  await expect(page.locator(".error[role=alert]")).toHaveText("This sign-in code or link is invalid or has expired.");
  await expect(page).toHaveURL(/\/login\/verify/);
});

test("a six-digit email code onboards a profile, persists across refresh, and signs out", async ({ page }) => {
  const email = `otp-${Date.now()}@example.test`;
  const message = await requestCode(page, email);
  const body = messageBody(message);
  const token = body.match(/\b\d{6}\b/)?.[0];
  expect(token).toBeTruthy();
  await page.getByLabel("Six-digit code").fill(token!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await completeOnboarding(page, "OTP Pal");
  await expect(page.getByText("Keep the score.")).toBeVisible();
  await expect(page.getByRole("link", { name: "OTP Pal" })).toHaveAttribute("href", "/profile");
  await page.reload();
  await expect(page.getByText("Keep the score.")).toBeVisible();
  await page.getByRole("link", { name: "OTP Pal" }).click();
  await expect(page.getByRole("heading", { name: "Make it yours." })).toBeVisible();
  await page.getByLabel("Visible name").fill("OTP Buddy");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toHaveText("Your visible name has been updated.");
  await page.getByRole("link", { name: "Back to your bets" }).click();
  await expect(page.getByRole("link", { name: "OTP Buddy" })).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});

test("a review link authenticates only after confirmation and cannot be reused", async ({ browser }) => {
  const email = `review-${Date.now()}@example.test`;
  const first = await browser.newContext();
  const page = await first.newPage();
  const message = await requestCode(page, email);
  const link = messageBody(message).match(/https?:\/\/[^\s<"]+token_hash=[^\s<"]+/)?.[0];
  expect(link).toBeTruthy();
  const localLink = new URL(link!);
  localLink.host = "127.0.0.1:3100";
  await page.goto(localLink.toString());
  await expect(page.getByText("Ready to sign in?")).toBeVisible();
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await page.goto(localLink.toString());
  await page.getByRole("button", { name: "Continue to Stakeout" }).click();
  await completeOnboarding(page, "Review Link User");
  await expect(page.getByText("Keep the score.")).toBeVisible();

  const second = await browser.newContext();
  const replay = await second.newPage();
  await replay.goto(localLink.toString());
  await replay.getByRole("button", { name: "Continue to Stakeout" }).click();
  await expect(replay.locator(".error[role=alert]")).toHaveText("This sign-in code or link is invalid or has expired.");
  await first.close();
  await second.close();
});

test("login normalizes email, offers another-email navigation, and rejects external next URLs", async ({ page }) => {
  const email = `normalize-${Date.now()}@example.test`;
  const entered = `  ${email.toUpperCase()}  `;
  const message = await requestCode(page, entered, "https://evil.example/steal");
  await expect(page.getByRole("button", { name: /Send again in/ })).toBeDisabled();
  await expect(page.getByRole("link", { name: "Use another email" })).toHaveAttribute("href", "/login");
  const token = messageBody(message).match(/\b\d{6}\b/)?.[0];
  await page.getByLabel("Six-digit code").fill(token!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await completeOnboarding(page, email);
  await expect(page).toHaveURL("http://127.0.0.1:3100/");
  await expect(page.getByText(email, { exact: true })).toBeVisible();
});

test("resend stays disabled during cooldown and sends a fresh credential when enabled", async ({ page }) => {
  const email = `resend-${Date.now()}@example.test`;
  await requestCode(page, email);
  const resend = page.getByRole("button", { name: /Send again in/ });
  await expect(resend).toBeDisabled();
  const before = await messageIds(email);
  await page.waitForTimeout(1_100);
  await page.evaluate(() => sessionStorage.setItem("auth-resend-after", "0"));
  await page.reload();
  await page.getByRole("button", { name: "Send a new code" }).click();
  await signInMessage(email, before);
  await expect(page.getByRole("button", { name: /Send again in/ })).toBeDisabled();
  await page.getByRole("link", { name: "Use another email" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("login remains keyboard-usable without horizontal overflow on a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Email address")).toBeFocused();
  const dimensions = await page.evaluate(() => ({ documentWidth: document.documentElement.scrollWidth, viewportWidth: window.innerWidth }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
  await expect(page.getByRole("button", { name: "Send my sign-in code" })).toBeInViewport();
});
