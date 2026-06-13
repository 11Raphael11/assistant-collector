import { describe, it, expect } from "vitest";
import { ALIAS_SENTINEL } from "@/lib/_alias.js";

describe("path alias @/*", () => {
  it("resolves @/lib/_alias and imports the sentinel", () => {
    expect(ALIAS_SENTINEL).toBe("alias-ok");
  });

  it("fails to import a non-existent module via @/lib/_missing", async () => {
    await expect(() => import("@/lib/_missing" as string)).rejects.toThrow();
  });
});
