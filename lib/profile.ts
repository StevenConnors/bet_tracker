import type { Route } from "next";
import { z } from "zod";
import { safeNext } from "./auth/redirect";
import { DISPLAY_NAME_MAX_LENGTH } from "./profile-constants";
import { usernameSchema } from "./identity";

export { DISPLAY_NAME_MAX_LENGTH } from "./profile-constants";

export const profileInputSchema = z.object({
  name: z.string()
    .trim()
    .min(1, "Enter the name you want friends to see.")
    .max(DISPLAY_NAME_MAX_LENGTH, `Visible name must be ${DISPLAY_NAME_MAX_LENGTH} characters or fewer.`)
    .refine(value => !/[\u0000-\u001f\u007f]/.test(value), "Visible name cannot contain control characters."),
  username: usernameSchema,
});

export function accountDisplayName(metadata?: Record<string, unknown>) {
  const candidates = [metadata?.full_name, metadata?.name];
  return candidates.find((value): value is string => typeof value === "string" && Boolean(value.trim()))?.trim();
}

export function needsProfileSetup(user: { onboardingPending?: boolean }) {
  return user.onboardingPending === true;
}

export function profileSetupPath(next: unknown = "/"): Route {
  return `/profile?next=${encodeURIComponent(safeNext(next))}` as Route;
}
