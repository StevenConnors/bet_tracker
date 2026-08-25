import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./auth-helper";

async function createRegisteredBet(page: Page, participantEmail: string, condition: string) {
  const draft = { condition, wager: "Winner chooses brunch.", deadline: "2030-06-01T12:00:00.000Z", participantEmails: [participantEmail] };
  const preview = await page.request.post("/api/bets/preview", { data: draft });
  expect(preview.ok()).toBe(true);
  const review = await preview.json();
  const created = await page.request.post("/api/bets", { data: { ...review.draft, confirmed: true, invitedEmails: review.missingEmails } });
  expect(created.status()).toBe(201);
  return (await created.json()).id as string;
}

test("admin routes and APIs reject a regular user", async ({ browser }) => {
  const regular = await signIn(browser, `regular-${Date.now()}@example.test`);
  await regular.page.goto("/admin");
  await expect(regular.page).toHaveURL("http://127.0.0.1:3100/");
  const api = await regular.page.request.get("/api/admin");
  expect(api.status()).toBe(403);
  await regular.context.close();
});

test("an admin manages roles, cannot self-demote, and moderates another creator's bet", async ({ browser }) => {
  const unique = Date.now();
  const memberEmail = `member-${unique}@example.test`;
  const member = await signIn(browser, memberEmail);
  const admin = await signIn(browser, "admin@example.test");
  const condition = `Admin moderation case ${unique}`;
  const betId = await createRegisteredBet(member.page, "admin@example.test", condition);

  await admin.page.goto("/admin");
  await expect(admin.page.getByRole("heading", { name: "Admin control." })).toBeVisible();
  const memberRow = admin.page.locator(".admin-row").filter({ hasText: memberEmail });
  await Promise.all([
    admin.page.waitForResponse(response => response.url().endsWith("/api/admin") && response.request().method() === "PATCH" && response.ok()),
    memberRow.getByRole("combobox").selectOption("admin"),
  ]);
  await expect(memberRow.getByRole("combobox")).toHaveValue("admin");
  await member.page.goto("/admin");
  await expect(member.page.getByRole("heading", { name: "Admin control." })).toBeVisible();

  await admin.page.reload();
  const selfRow = admin.page.locator(".admin-row").filter({ hasText: "admin@example.test" }).first();
  await selfRow.getByRole("combobox").selectOption("user");
  await expect(admin.page.getByText("You cannot remove your own admin access")).toBeVisible();
  await expect(selfRow.getByRole("combobox")).toHaveValue("admin");

  const betRow = admin.page.locator(".admin-row").filter({ hasText: condition });
  admin.page.once("dialog", dialog => dialog.dismiss());
  await betRow.getByRole("button", { name: "Cancel" }).click();
  await expect(betRow.getByText("open", { exact: true })).toBeVisible();
  admin.page.once("dialog", dialog => dialog.accept());
  await betRow.getByRole("button", { name: "Cancel" }).click();
  await expect(admin.page.locator(".admin-row").filter({ hasText: condition }).getByText("cancelled", { exact: true })).toBeVisible();
  const bet = await member.page.request.get(`/api/bets/${betId}`);
  expect((await bet.json()).bet.status).toBe("cancelled");

  await admin.page.reload();
  await Promise.all([
    admin.page.waitForResponse(response => response.url().endsWith("/api/admin") && response.request().method() === "PATCH" && response.ok()),
    admin.page.locator(".admin-row").filter({ hasText: memberEmail }).getByRole("combobox").selectOption("user"),
  ]);
  await member.page.goto("/admin");
  await expect(member.page).toHaveURL("http://127.0.0.1:3100/");
  await member.context.close();
  await admin.context.close();
});
