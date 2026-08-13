import { describe, expect, it } from "vitest";
import { isOverdue } from "./types";

describe("isOverdue", () => {
  it("marks only open bets with elapsed deadlines as overdue", () => {
    expect(isOverdue({ status: "open", deadline: new Date(Date.now() - 1) })).toBe(true);
    expect(isOverdue({ status: "open", deadline: new Date(Date.now() + 60_000) })).toBe(false);
    expect(isOverdue({ status: "completed", deadline: new Date(Date.now() - 1) })).toBe(false);
  });
});
