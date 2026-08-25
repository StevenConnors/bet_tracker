import { describe, expect, it } from "vitest";
import { normalizeUsername, usernameSchema, usernameSuggestion } from "./identity";

describe("usernames", () => {
  it("normalizes exact lookup handles to lowercase", () => {
    expect(normalizeUsername("  Stevie_C  ")).toBe("stevie_c");
    expect(usernameSchema.parse("  Stevie_C  ")).toBe("stevie_c");
  });

  it("accepts only three to twenty-four letters, numbers, or underscores", () => {
    expect(usernameSchema.safeParse("ab").success).toBe(false);
    expect(usernameSchema.safeParse("two words").success).toBe(false);
    expect(usernameSchema.safeParse("hyphen-name").success).toBe(false);
    expect(usernameSchema.safeParse("x".repeat(25)).success).toBe(false);
    expect(usernameSchema.safeParse("friend_42").success).toBe(true);
  });

  it("creates a valid onboarding suggestion from a display name or email prefix", () => {
    expect(usernameSuggestion(" Stevie Connors ")).toBe("stevie_connors");
    expect(usernameSuggestion("A!")).toBe("a00");
  });
});
