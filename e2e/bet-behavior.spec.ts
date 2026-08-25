import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./auth-helper";

async function createBet(page: Page, participantEmails: string[], condition: string, deadline = "2030-06-01T12:00:00.000Z") {
  const draft = { condition, wager: "A celebratory coffee", deadline, participantEmails };
  const preview = await page.request.post("/api/bets/preview", { data: draft });
  expect(preview.ok()).toBe(true);
  const review = await preview.json();
  const created = await page.request.post("/api/bets", { data: { ...review.draft, confirmed: true, invitedEmails: review.missingEmails } });
  expect(created.status()).toBe(201);
  return (await created.json()).id as string;
}

test("empty states, composer controls, validation, duplicate emails, and overdue presentation work", async ({ browser }) => {
  const unique = Date.now();
  const creatorEmail = `validation-${unique}@example.test`;
  const creator = await signIn(browser, creatorEmail);
  await expect(creator.page.getByText("No active bets yet.")).toBeVisible();
  await creator.page.getByRole("button", { name: "History" }).click();
  await expect(creator.page.getByText("No history bets yet.")).toBeVisible();

  await creator.page.getByRole("button", { name: "+ New bet" }).click();
  await creator.page.getByRole("button", { name: "Close" }).click();
  await expect(creator.page.getByRole("heading", { name: "Make a new bet" })).toHaveCount(0);
  await creator.page.getByRole("button", { name: "+ New bet" }).click();
  await creator.page.getByRole("button", { name: "Review bet" }).click();
  await expect(creator.page.getByLabel("What needs to happen?")).toHaveJSProperty("validity.valid", false);

  await creator.page.getByLabel("What needs to happen?").fill("Duplicate participant normalization");
  await creator.page.getByLabel("What’s at stake?").fill("Coffee");
  await creator.page.getByLabel("Deadline").fill("2030-12-31T12:00");
  await creator.page.getByLabel("Invite someone new by email Optional. Separate multiple addresses with commas.").fill(` INVITED-${unique}@EXAMPLE.TEST, invited-${unique}@example.test, ${creatorEmail}`);
  await creator.page.getByRole("button", { name: "Review bet" }).click();
  await expect(creator.page.getByRole("listitem")).toHaveCount(1);
  await expect(creator.page.getByRole("listitem")).toContainText(`invited-${unique}@example.test`);
  await creator.page.getByRole("button", { name: "Back to edit" }).click();
  const betsBefore = await creator.page.request.get("/api/bets");
  expect((await betsBefore.json()).bets).toHaveLength(0);
  await creator.page.getByRole("button", { name: "Close" }).click();

  await createBet(creator.page, [`overdue-${unique}@example.test`], `Overdue bet ${unique}`, "2020-01-01T12:00:00.000Z");
  await creator.page.reload();
  const overdue = creator.page.getByRole("button", { name: new RegExp(`Overdue bet ${unique}`) });
  await expect(overdue.getByText("overdue", { exact: true })).toBeVisible();
  await expect(creator.page.getByRole("button", { name: /Active 1/ })).toBeVisible();
  await creator.context.close();
});

test("completed, unresolved, and cancelled bets move to History and closed bets reject later changes", async ({ browser }) => {
  const unique = Date.now();
  const creator = await signIn(browser, `lifecycle-${unique}@example.test`);
  const participant = `lifecycle-friend-${unique}@example.test`;
  const statuses = ["completed", "unresolved", "cancelled"] as const;
  const ids: Record<string, string> = {};
  for (const status of statuses) {
    const condition = `${status} lifecycle ${unique}`;
    ids[status] = await createBet(creator.page, [participant], condition);
    const response = await creator.page.request.patch(`/api/bets/${ids[status]}`, { data: { status, resolutionNote: `${status} outcome` } });
    expect(response.ok()).toBe(true);
  }
  await creator.page.reload();
  await expect(creator.page.getByText("No active bets yet.")).toBeVisible();
  await creator.page.getByRole("button", { name: "History" }).click();
  for (const status of statuses) {
    const card = creator.page.getByRole("button", { name: new RegExp(`${status} lifecycle ${unique}`) });
    await expect(card).toBeVisible();
    await expect(card.getByText(status, { exact: true })).toBeVisible();
  }
  await creator.page.getByRole("button", { name: new RegExp(`unresolved lifecycle ${unique}`) }).click();
  await expect(creator.page.getByText("unresolved outcome", { exact: true })).toBeVisible();
  await expect(creator.page.getByRole("button", { name: "Complete", exact: true })).toHaveCount(0);
  const secondClose = await creator.page.request.patch(`/api/bets/${ids.completed}`, { data: { status: "cancelled" } });
  expect(secondClose.status()).toBe(409);
  await creator.context.close();
});

test("recent activity is private, newest-first, and limited to six visible entries", async ({ browser }) => {
  const unique = Date.now();
  const creatorEmail = `activity-${unique}@example.test`;
  const friendEmail = `activity-friend-${unique}@example.test`;
  const outsiderEmail = `activity-outsider-${unique}@example.test`;
  const friend = await signIn(browser, friendEmail);
  const creator = await signIn(browser, creatorEmail);
  const outsider = await signIn(browser, outsiderEmail);
  for (let index = 0; index < 7; index += 1) await createBet(creator.page, [friendEmail], `Activity bet ${index} ${unique}`);
  await creator.page.reload();
  await expect(creator.page.locator(".activity")).toHaveCount(6);
  await expect(creator.page.locator(".activity").first()).toContainText(`${creatorEmail} created a bet.`);
  await friend.page.reload();
  await expect(friend.page.locator(".activity")).toHaveCount(6);
  const outsiderActivities = await outsider.page.request.get("/api/activities");
  expect((await outsiderActivities.json()).activities).toHaveLength(0);
  await friend.context.close();
  await creator.context.close();
  await outsider.context.close();
});

test("dashboard request failures show an accessible error and recover after reload", async ({ browser }) => {
  const user = await signIn(browser, `failure-${Date.now()}@example.test`);
  await user.page.route("**/api/bets", route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Temporarily unavailable" }) }));
  await user.page.reload();
  await expect(user.page.locator(".error[role=alert]")).toContainText("Could not load your bets");
  await user.page.unroute("**/api/bets");
  await user.page.reload();
  await expect(user.page.locator(".error[role=alert]")).toHaveCount(0);
  await expect(user.page.getByText("No active bets yet.")).toBeVisible();
  await user.context.close();
});

test("malformed and missing private bet URLs return controlled not-found pages", async ({ page }) => {
  await page.goto("/bets/not-an-object-id");
  await expect(page.getByText("This page could not be found.")).toBeVisible();
  await page.goto("/bets/000000000000000000000000");
  await expect(page).toHaveURL(/\/login\?next=/);
});

test("simultaneous resolutions produce one winner and one conflict", async ({ browser }) => {
  const unique = Date.now();
  const creator = await signIn(browser, `race-${unique}@example.test`);
  const id = await createBet(creator.page, [`race-friend-${unique}@example.test`], `Resolution race ${unique}`);
  const [completed, cancelled] = await Promise.all([
    creator.page.request.patch(`/api/bets/${id}`, { data: { status: "completed", resolutionNote: "first contender" } }),
    creator.page.request.patch(`/api/bets/${id}`, { data: { status: "cancelled", resolutionNote: "second contender" } }),
  ]);
  expect([completed.status(), cancelled.status()].sort()).toEqual([200, 409]);
  const final = await creator.page.request.get(`/api/bets/${id}`);
  expect(["completed", "cancelled"]).toContain((await final.json()).bet.status);
  await creator.context.close();
});

test("server-side creation and resolution boundaries reject oversized payloads", async ({ browser }) => {
  const unique = Date.now();
  const creator = await signIn(browser, `boundaries-${unique}@example.test`);
  const invalidDraft = await creator.page.request.post("/api/bets/preview", { data: { condition: "ab", wager: "x", deadline: "not-a-date", participantEmails: ["not-an-email"] } });
  expect(invalidDraft.status()).toBe(400);
  const tooMany = await creator.page.request.post("/api/bets/preview", { data: { condition: "Valid condition", wager: "Valid wager", deadline: "2030-01-01T00:00:00.000Z", participantEmails: Array.from({ length: 21 }, (_, index) => `friend-${index}@example.test`) } });
  expect(tooMany.status()).toBe(400);
  const id = await createBet(creator.page, [`note-friend-${unique}@example.test`], `Note boundary ${unique}`);
  const oversizedNote = await creator.page.request.patch(`/api/bets/${id}`, { data: { status: "completed", resolutionNote: "x".repeat(601) } });
  expect(oversizedNote.status()).toBe(400);
  const unchanged = await creator.page.request.get(`/api/bets/${id}`);
  expect((await unchanged.json()).bet.status).toBe("open");
  await creator.context.close();
});
