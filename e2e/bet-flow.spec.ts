import { expect, test, type Browser } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";

const captureFile = ".local/e2e-mail.json";
async function magicLink(email: string) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const messages = JSON.parse(await readFile(captureFile, "utf8"));
      const message = [...messages].reverse().find((item: { to: string[] }) => item.to.includes(email));
      if (message) {
        const raw = message.raw.replace(/=\r?\n/g, "").replace(/=3D/g, "=").replace(/&amp;/g, "&");
        const url = raw.match(/https?:\/\/[^\s<"]+/)?.[0];
        if (url) {
          const link = new URL(url);
          link.searchParams.set("callbackUrl", "http://127.0.0.1:3100/");
          return link.toString();
        }
      }
    } catch { /* capture file has not been created yet */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`No magic link received for ${email}`);
}
async function signIn(browser: Browser, email: string) {
  const context = await browser.newContext(); const page = await context.newPage();
  await page.goto("/login"); await page.getByLabel("Email address").fill(email); await page.getByRole("button", { name: "Send me a sign-in link" }).click();
  const response = await page.request.get(await magicLink(email));
  expect(response.ok()).toBeTruthy();
  await page.goto("/"); await expect(page.getByText("Keep the score.")).toBeVisible();
  return { context, page };
}
test("registered friends can create, view, and complete a shared bet", async ({ browser }) => {
  await mkdir("artifacts/e2e", { recursive: true });
  const friend = await signIn(browser, "friend@example.test");
  const admin = await signIn(browser, "admin@example.test");
  await admin.page.screenshot({ path: "artifacts/e2e/01-admin-dashboard.png", fullPage: true });

  await admin.page.getByRole("button", { name: "+ New bet" }).click();
  await admin.page.getByLabel("What needs to happen?").fill("The hometown team reaches the playoffs.");
  await admin.page.getByLabel("What’s at stake?").fill("Loser brings coffee next week.");
  await admin.page.getByLabel("Deadline").fill("2030-12-31T12:00");
  await admin.page.getByLabel("Friends’ registered emails Separate multiple addresses with commas.").fill("friend@example.test");
  await admin.page.getByRole("button", { name: "Create bet" }).click();
  await expect(admin.page.getByText("The hometown team reaches the playoffs.")).toBeVisible();
  await admin.page.screenshot({ path: "artifacts/e2e/02-bet-created.png", fullPage: true });

  await friend.page.reload(); await expect(friend.page.getByText("The hometown team reaches the playoffs.")).toBeVisible();
  await friend.page.screenshot({ path: "artifacts/e2e/03-participant-view.png", fullPage: true });

  await admin.page.getByRole("button", { name: /The hometown team reaches the playoffs/ }).click();
  await admin.page.getByLabel("Outcome note Optional; visible to participants.").fill("The team qualified.");
  await admin.page.getByRole("button", { name: "Complete" }).click();
  await expect(admin.page.getByRole("button", { name: "History" })).toBeVisible();
  await admin.page.getByRole("button", { name: "History" }).click();
  await expect(admin.page.locator(".badge.completed")).toBeVisible();
  await admin.page.screenshot({ path: "artifacts/e2e/04-bet-completed.png", fullPage: true });
  await admin.context.close(); await friend.context.close();
});
