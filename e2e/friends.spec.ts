import { expect, test } from "@playwright/test";
import { signIn } from "./auth-helper";

test("friends are one-way, survive username changes, and can be added to bets", async ({ browser }) => {
  const suffix = Date.now().toString(36);
  const creatorUsername = `creator_${suffix}`.slice(0, 24);
  const originalFriendUsername = `friend_${suffix}`.slice(0, 24);
  const renamedFriendUsername = `pal_${suffix}`.slice(0, 24);
  const creator = await signIn(browser, `friend-owner-${suffix}@example.test`, { name: "Bet Creator", username: creatorUsername });
  const friend = await signIn(browser, `friend-target-${suffix}@example.test`, { name: "Friendly Person", username: originalFriendUsername });
  const outsider = await signIn(browser, `friend-outsider-${suffix}@example.test`, { name: "Outside Person", username: `outside_${suffix}`.slice(0, 24) });

  await creator.page.goto("/friends");
  await expect(creator.page.getByText(`Friends can add you as @${creatorUsername}.`)).toBeVisible();
  await creator.page.getByLabel("Username").fill(originalFriendUsername.toUpperCase());
  await creator.page.getByRole("button", { name: "Add friend" }).click();
  await expect(creator.page.getByRole("status")).toContainText("Friendly Person is now in your friends.");
  const friendRow = creator.page.getByRole("listitem").filter({ hasText: "Friendly Person" });
  await expect(friendRow).toContainText(`@${originalFriendUsername}`);

  const creatorFriends = await creator.page.request.get("/api/friends");
  const addedFriend = (await creatorFriends.json()).friends[0] as { id: string; username: string };
  const reverseFriends = await friend.page.request.get("/api/friends");
  expect((await reverseFriends.json()).friends).toHaveLength(0);
  const duplicate = await creator.page.request.post("/api/friends", { data: { username: originalFriendUsername } });
  expect(duplicate.status()).toBe(409);

  await friend.page.goto("/profile");
  await friend.page.getByLabel("Username").fill(renamedFriendUsername);
  await friend.page.getByRole("button", { name: "Save changes" }).click();
  await expect(friend.page.getByRole("status")).toHaveText("Your profile has been updated.");
  await creator.page.reload();
  await expect(creator.page.getByRole("listitem").filter({ hasText: "Friendly Person" })).toContainText(`@${renamedFriendUsername}`);
  const friendsAfterRename = await creator.page.request.get("/api/friends");
  expect((await friendsAfterRename.json()).friends[0]).toMatchObject({ id: addedFriend.id, username: renamedFriendUsername });
  const oldUsername = await creator.page.request.post("/api/friends", { data: { username: originalFriendUsername } });
  expect(oldUsername.status()).toBe(404);
  const duplicateUsername = await creator.page.request.patch("/api/profile", { data: { name: "Bet Creator", username: renamedFriendUsername } });
  expect(duplicateUsername.status()).toBe(409);

  const forgedSelection = await outsider.page.request.post("/api/bets/preview", { data: {
    condition: "A forged friend selection",
    wager: "Coffee",
    deadline: "2030-12-31T12:00:00.000Z",
    friendIds: [addedFriend.id],
    participantEmails: [],
  } });
  expect(forgedSelection.status()).toBe(400);

  const condition = `Friends-list bet ${suffix}`;
  await creator.page.goto("/");
  await creator.page.getByRole("button", { name: "+ New bet" }).click();
  await creator.page.getByLabel("What needs to happen?").fill(condition);
  await creator.page.getByLabel("What’s at stake?").fill("Winner chooses the next coffee shop.");
  await creator.page.getByLabel("Deadline").fill("2030-12-31T12:00");
  await creator.page.getByLabel(/Friendly Person/).check();
  await creator.page.getByRole("button", { name: "Review bet" }).click();
  const reviewedFriend = creator.page.getByRole("listitem").filter({ hasText: "Friendly Person" });
  await expect(reviewedFriend).toContainText(`@${renamedFriendUsername}`);
  await expect(reviewedFriend.getByText("Friend", { exact: true })).toBeVisible();
  await creator.page.getByRole("button", { name: "Confirm and create bet" }).click();
  await expect(creator.page.getByText("Bet created.", { exact: true })).toBeVisible();
  await friend.page.goto("/");
  await expect(friend.page.getByText(condition)).toBeVisible();

  await creator.page.goto("/friends");
  creator.page.once("dialog", dialog => dialog.accept());
  await creator.page.getByRole("listitem").filter({ hasText: "Friendly Person" }).getByRole("button", { name: "Remove" }).click();
  await expect(creator.page.getByRole("status")).toHaveText("Friend removed.");
  await expect(creator.page.getByRole("listitem").filter({ hasText: "Friendly Person" })).toHaveCount(0);
  await creator.page.goto("/");
  await expect(creator.page.getByText(condition)).toBeVisible();
  await friend.page.reload();
  await expect(friend.page.getByText(condition)).toBeVisible();

  await creator.context.close();
  await friend.context.close();
  await outsider.context.close();
});
