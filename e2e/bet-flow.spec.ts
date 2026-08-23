import { expect, test, type Browser, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";

type MessageSummary = { ID: string; Subject?: string; To?: { Address: string }[] };

async function messageIds(email: string) {
  const list = await fetch("http://127.0.0.1:54324/api/v1/messages").then(response => response.json()).catch(() => null);
  return new Set<string>((list?.messages || []).filter((item: MessageSummary) => item.To?.some(to => to.Address === email)).map((item: MessageSummary) => item.ID));
}

async function waitForMessage(email: string, existing: Set<string>, subject: RegExp) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const list = await fetch("http://127.0.0.1:54324/api/v1/messages").then(response => response.json()).catch(() => null);
    const summary = list?.messages?.find((item: MessageSummary) => !existing.has(item.ID) && item.To?.some(to => to.Address === email) && subject.test(item.Subject || ""));
    if (summary?.ID) {
      const message = await fetch(`http://127.0.0.1:54324/api/v1/message/${summary.ID}`).then(response => response.json());
      return `${message.HTML || ""}\n${message.Text || ""}`.replace(/&amp;/g, "&");
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`No matching email received for ${email}`);
}

async function signInLink(email: string, existing: Set<string>) {
  const body = await waitForMessage(email, existing, /^Your Stakeout sign-in code$/);
  const url = body.match(/https?:\/\/[^\s<"]+token_hash=[^\s<"]+/)?.[0];
  if (!url) throw new Error(`No sign-in link received for ${email}`);
  return url;
}

async function invitationMessage(email: string, existing: Set<string>) {
  return waitForMessage(email, existing, /invited you to a Stakeout bet$/);
}

async function finishEmailSignIn(page: Page, email: string, existing: Set<string>) {
  const link = new URL(await signInLink(email, existing));
  link.host = "127.0.0.1:3100";
  await page.goto(link.toString());
  await expect(page.getByText("Ready to sign in?")).toBeVisible();
  await page.getByRole("button", { name: "Continue to Stakeout" }).click();
}

async function signIn(browser: Browser, email: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const existing = await messageIds(email);
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Send my sign-in code" }).click();
  await finishEmailSignIn(page, email, existing);
  await expect(page.getByText("Keep the score.")).toBeVisible();
  return { context, page };
}

async function fillBet(page: Page, condition: string, participantEmail: string) {
  await page.getByRole("button", { name: "+ New bet" }).click();
  await page.getByLabel("What needs to happen?").fill(condition);
  await page.getByLabel("What’s at stake?").fill("Loser brings coffee next week.");
  await page.getByLabel("Deadline").fill("2030-12-31T12:00");
  await page.getByLabel("Friends’ emails Separate multiple addresses with commas.").fill(participantEmail);
  await page.getByRole("button", { name: "Review bet" }).click();
  await expect(page.getByRole("heading", { name: "Review your bet" })).toBeVisible();
}

test("registered friends can review, create, view, and complete a shared bet", async ({ browser }) => {
  await mkdir("artifacts/e2e", { recursive: true });
  const friend = await signIn(browser, "friend@example.test");
  const creator = await signIn(browser, "creator@example.test");
  const condition = `The hometown team reaches the playoffs ${Date.now()}.`;

  await fillBet(creator.page, condition, "friend@example.test");
  await expect(creator.page.getByText("Registered", { exact: true })).toBeVisible();
  await expect(creator.page.getByRole("definition").filter({ hasText: condition })).toBeVisible();
  await expect(creator.page.getByRole("definition").filter({ hasText: "Loser brings coffee next week." })).toBeVisible();
  await creator.page.getByRole("button", { name: "Confirm and create bet" }).click();
  await expect(creator.page.getByText("Bet created.", { exact: true })).toBeVisible();
  await expect(creator.page.getByText(condition)).toBeVisible();
  await friend.page.reload();
  await expect(friend.page.getByText(condition)).toBeVisible();

  await friend.page.getByRole("button", { name: new RegExp(condition) }).click();
  await expect(friend.page.getByRole("button", { name: "Complete" })).toHaveCount(0);
  const friendBets = await friend.page.request.get("/api/bets");
  const sharedBet = (await friendBets.json()).bets.find((bet: { condition: string }) => bet.condition === condition);
  const forbiddenPatch = await friend.page.request.patch(`/api/bets/${sharedBet._id}`, { data: { status: "cancelled" } });
  expect(forbiddenPatch.status()).toBe(403);
  await friend.page.getByRole("button", { name: "Close" }).click();

  await creator.page.getByRole("button", { name: new RegExp(condition) }).click();
  await creator.page.getByLabel("Outcome note Optional; visible to participants.").fill("The team qualified.");
  await creator.page.getByRole("button", { name: "Complete" }).click();
  await expect(creator.page.getByText(condition)).toHaveCount(0);
  await creator.page.getByRole("button", { name: "History" }).click();
  const completedCard = creator.page.getByRole("button", { name: new RegExp(condition) });
  await expect(completedCard).toBeVisible();
  await expect(completedCard.getByText("completed", { exact: true })).toBeVisible();
  await completedCard.click();
  await expect(creator.page.getByText("The team qualified.", { exact: true })).toBeVisible();
  await creator.page.reload();
  await creator.page.getByRole("button", { name: "History" }).click();
  await expect(creator.page.getByText(condition)).toBeVisible();
  await friend.page.reload();
  await friend.page.getByRole("button", { name: "History" }).click();
  await expect(friend.page.getByText(condition)).toBeVisible();
  await creator.context.close();
  await friend.context.close();
});

test("an unregistered friend is invited to a private bet and returns to it after signup", async ({ browser }) => {
  const unique = Date.now();
  const creatorEmail = `creator-${unique}@example.test`;
  const inviteeEmail = `invitee-${unique}@example.test`;
  const outsiderEmail = `outsider-${unique}@example.test`;
  const condition = `The invited friend predicts the final score ${unique}.`;
  const creator = await signIn(browser, creatorEmail);
  const inviteMessagesBefore = await messageIds(inviteeEmail);

  await fillBet(creator.page, condition, inviteeEmail);
  await expect(creator.page.getByText(`We did not find an account for ${inviteeEmail}.`)).toBeVisible();
  await expect(creator.page.getByText("Would you like to invite them?", { exact: false })).toBeVisible();
  const beforeConfirmation = await creator.page.request.get("/api/bets");
  expect((await beforeConfirmation.json()).bets.some((bet: { condition: string }) => bet.condition === condition)).toBe(false);

  await creator.page.getByRole("button", { name: "Confirm, create, and send invite" }).click();
  await expect(creator.page.getByText("Bet created and invitation sent.")).toBeVisible();
  const inviteBody = await invitationMessage(inviteeEmail, inviteMessagesBefore);
  expect(inviteBody).toContain(condition);
  expect(inviteBody).toContain("Loser brings coffee next week.");
  expect(inviteBody).toContain(creatorEmail);
  const rawInvitationUrl = inviteBody.match(/https?:\/\/[^\s<"]+\/bets\/[a-f0-9]{24}/)?.[0];
  expect(rawInvitationUrl).toBeTruthy();
  const invitedUrl = new URL(rawInvitationUrl!);
  invitedUrl.host = "127.0.0.1:3100";
  const betId = invitedUrl.pathname.split("/").pop()!;

  const outsider = await signIn(browser, outsiderEmail);
  const privateResponse = await outsider.page.request.get(`/api/bets/${betId}`);
  expect(privateResponse.status()).toBe(404);
  const outsiderBets = await outsider.page.request.get("/api/bets");
  expect((await outsiderBets.json()).bets.some((bet: { _id: string }) => bet._id === betId)).toBe(false);
  await outsider.page.goto(`/bets/${betId}`);
  await expect(outsider.page.getByText("This page could not be found.")).toBeVisible();

  const inviteeContext = await browser.newContext();
  const inviteePage = await inviteeContext.newPage();
  await inviteePage.goto(invitedUrl.toString());
  await expect(inviteePage).toHaveURL(new RegExp(`/login\\?next=.*bets.*${betId}`));
  const signInMessagesBefore = await messageIds(inviteeEmail);
  await inviteePage.getByLabel("Email address").fill(inviteeEmail);
  await inviteePage.getByRole("button", { name: "Send my sign-in code" }).click();
  await finishEmailSignIn(inviteePage, inviteeEmail, signInMessagesBefore);
  await expect(inviteePage).toHaveURL(invitedUrl.toString());
  await expect(inviteePage.getByRole("heading", { name: condition })).toBeVisible();
  await expect(inviteePage.getByRole("listitem").filter({ hasText: inviteeEmail })).toBeVisible();
  await inviteePage.goto("/");
  await expect(inviteePage.getByText(condition)).toBeVisible();

  await creator.context.close();
  await outsider.context.close();
  await inviteeContext.close();
});

test("a mixed participant review invites only unregistered normalized addresses", async ({ browser }) => {
  const unique = Date.now();
  const registeredEmail = `registered-${unique}@example.test`;
  const inviteeEmail = `mixed-invitee-${unique}@example.test`;
  const registered = await signIn(browser, registeredEmail);
  const creator = await signIn(browser, `mixed-creator-${unique}@example.test`);
  const registeredBefore = await messageIds(registeredEmail);
  const inviteeBefore = await messageIds(inviteeEmail);
  const condition = `Mixed group prediction ${unique}`;
  await fillBet(creator.page, condition, `${registeredEmail}, ${inviteeEmail.toUpperCase()}, ${inviteeEmail}`);
  await expect(creator.page.getByRole("listitem").filter({ hasText: registeredEmail }).getByText("Registered", { exact: true })).toBeVisible();
  await expect(creator.page.getByRole("listitem").filter({ hasText: inviteeEmail }).getByText("Invite", { exact: true })).toBeVisible();
  await expect(creator.page.getByRole("listitem")).toHaveCount(2);
  await creator.page.getByRole("button", { name: "Confirm, create, and send invite" }).click();
  await expect(creator.page.getByText("Bet created and invitation sent.")).toBeVisible();
  const invite = await invitationMessage(inviteeEmail, inviteeBefore);
  expect(invite).toContain(condition);
  const registeredAfter = await messageIds(registeredEmail);
  expect([...registeredAfter].filter(id => !registeredBefore.has(id))).toHaveLength(0);
  await registered.page.reload();
  await expect(registered.page.getByText(condition)).toBeVisible();
  await registered.context.close();
  await creator.context.close();
});

test("confirmation requires a fresh review when an invitee registers meanwhile", async ({ browser }) => {
  const unique = Date.now();
  const inviteeEmail = `status-change-${unique}@example.test`;
  const creator = await signIn(browser, `status-creator-${unique}@example.test`);
  await fillBet(creator.page, `Status changed during review ${unique}`, inviteeEmail);
  await expect(creator.page.getByText("Invite", { exact: true })).toBeVisible();
  const invitee = await signIn(browser, inviteeEmail);
  await creator.page.getByRole("button", { name: "Confirm, create, and send invite" }).click();
  await expect(creator.page.locator(".error[role=alert]")).toContainText("Participant account status changed");
  await expect(creator.page.getByText("Registered", { exact: true })).toBeVisible();
  const bets = await creator.page.request.get("/api/bets");
  expect((await bets.json()).bets.some((bet: { condition: string }) => bet.condition === `Status changed during review ${unique}`)).toBe(false);
  await creator.page.getByRole("button", { name: "Confirm and create bet" }).click();
  await expect(creator.page.getByText("Bet created.", { exact: true })).toBeVisible();
  await creator.context.close();
  await invitee.context.close();
});
