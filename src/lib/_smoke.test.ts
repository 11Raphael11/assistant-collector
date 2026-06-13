import { describe, it, expect } from "vitest";
import { greet } from "@/lib/greeting";

describe("smoke", () => {
  it("1 + 1 = 2", () => {
    expect(1 + 1).toBe(2);
  });

  it("@/* alias resolves correctly", () => {
    expect(greet("World")).toBe("Hello, World!");
  });

  it.skip("intentionally wrong assertion (proves runner catches failures)", () => {
    expect(1 + 1).toBe(3);
  });
});
