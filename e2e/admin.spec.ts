import { expect, test, type Browser, type Page } from "@playwright/test";

type MessageSummary = { ID: string; Subject?: string; To?: { Address: string }[] };

async function messageIds(email: string) {
  const list = await fetch("http://127.0.0.1:54324/api/v1/messages").then(response => response.json());
  return new Set<string>((list.messages || []).filter((item: MessageSummary) => item.To?.some(to => to.Address === email)).map((item: MessageSummary) => item.ID));
}

async function signIn(browser: Browser, email: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const existing = await messageIds(email);
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Send my sign-in code" }).click();
  let link: string | undefined;
  for (let attempt = 0; attempt < 80 && !link; attempt += 1) {
    const list = await fetch("http://127.0.0.1:54324/api/v1/messages").then(response => response.json());
    const summary = list.messages?.find((item: MessageSummary) => !existing.has(item.ID) && item.Subject === "Your Stakeout sign-in code" && item.To?.some(to => to.Address === email));
    if (summary?.ID) {
      const message = await fetch(`http://127.0.0.1:54324/api/v1/message/${summary.ID}`).then(response => response.json());
      link = `${message.HTML || ""}\n${message.Text || ""}`.replace(/&amp;/g, "&").match(/https?:\/\/[^\s<"]+token_hash=[^\s<"]+/)?.[0];
    }
    if (!link) await new Promise(resolve => setTimeout(resolve, 250));
  }
  if (!link) throw new Error(`No sign-in link received for ${email}`);
  const url = new URL(link);
  url.host = "127.0.0.1:3100";
  await page.goto(url.toString());
  await page.getByRole("button", { name: "Continue to Stakeout" }).click();
  await expect(page.getByRole("heading", { name: "What should we call you?" })).toBeVisible();
  await page.getByLabel("Visible name").fill(email);
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page.getByText("Keep the score.")).toBeVisible();
  return { context, page };
}

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
