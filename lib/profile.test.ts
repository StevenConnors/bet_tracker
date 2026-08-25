import { describe, expect, it } from "vitest";
import { accountDisplayName, DISPLAY_NAME_MAX_LENGTH, needsProfileSetup, profileInputSchema, profileSetupPath } from "./profile";

describe("profileInputSchema", () => {
  it("trims a valid visible name", () => {
    expect(profileInputSchema.parse({ name: "  Stevie C  ", username: " Stevie_C " })).toEqual({ name: "Stevie C", username: "stevie_c" });
  });

  it("rejects empty, oversized, and control-character names", () => {
    expect(profileInputSchema.safeParse({ name: "   ", username: "valid_name" }).success).toBe(false);
    expect(profileInputSchema.safeParse({ name: "x".repeat(DISPLAY_NAME_MAX_LENGTH + 1), username: "valid_name" }).success).toBe(false);
    expect(profileInputSchema.safeParse({ name: "Line\nBreak", username: "valid_name" }).success).toBe(false);
  });
});

describe("profile onboarding", () => {
  it("prefills Google's full name and falls back to its generic name metadata", () => {
    expect(accountDisplayName({ full_name: "  Formal Google Name  ", name: "Nickname" })).toBe("Formal Google Name");
    expect(accountDisplayName({ full_name: "  ", name: "  Nickname  " })).toBe("Nickname");
  });

  it("only treats explicitly pending accounts as needing setup", () => {
    expect(needsProfileSetup({ onboardingPending: true })).toBe(true);
    expect(needsProfileSetup({ onboardingPending: false })).toBe(false);
    expect(needsProfileSetup({})).toBe(false);
  });

  it("preserves safe destinations and rejects external ones", () => {
    expect(profileSetupPath("/bets/abc?from=invite")).toBe("/profile?next=%2Fbets%2Fabc%3Ffrom%3Dinvite");
    expect(profileSetupPath("https://evil.example")).toBe("/profile?next=%2F");
  });
});
