import { describe, expect, it } from "vitest";
import { safeNext } from "./redirect";
describe("safeNext", () => {
  it("allows internal paths", () => expect(safeNext("/admin?tab=users")).toBe("/admin?tab=users"));
  it.each(["https://evil.test", "//evil.test", "javascript:alert(1)", null])("rejects unsafe redirects", value => expect(safeNext(value)).toBe("/"));
});
