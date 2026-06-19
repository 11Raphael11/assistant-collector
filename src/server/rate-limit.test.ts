import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { prisma } from "./db";
import { checkRateLimit } from "./rate-limit";

const TEST_PREFIX = "test_rl_";

async function cleanup(): Promise<void> {
  await prisma.$executeRaw`
    DELETE FROM "RateBucket" WHERE "key" LIKE ${TEST_PREFIX + "%"}
  `;
}

describe("server/rate-limit checkRateLimit", () => {
  beforeAll(async () => {
    await cleanup();
  });

  beforeEach(async () => {
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("happy: calls under limit all return ok", async () => {
    const key = `${TEST_PREFIX}happy`;
    const limit = 5;
    const windowSec = 60;

    for (let i = 0; i < limit; i++) {
      const result = await checkRateLimit(key, limit, windowSec);
      expect(result.ok).toBe(true);
    }
  });

  it("edge: call exceeding limit returns RATE_LIMITED", async () => {
    const key = `${TEST_PREFIX}over`;
    const limit = 3;
    const windowSec = 60;

    for (let i = 0; i < limit; i++) {
      const result = await checkRateLimit(key, limit, windowSec);
      expect(result.ok).toBe(true);
    }

    const result = await checkRateLimit(key, limit, windowSec);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("RATE_LIMITED");
    }
  });

  it("happy: separate keys have independent counters (CGNAT-safe)", async () => {
    const keyA = `${TEST_PREFIX}user_a`;
    const keyB = `${TEST_PREFIX}user_b`;
    const limit = 2;
    const windowSec = 60;

    await checkRateLimit(keyA, limit, windowSec);
    await checkRateLimit(keyA, limit, windowSec);

    const resultA = await checkRateLimit(keyA, limit, windowSec);
    expect(resultA.ok).toBe(false);

    const resultB = await checkRateLimit(keyB, limit, windowSec);
    expect(resultB.ok).toBe(true);
  });

  it("edge: concurrent increments are atomic (no under-count)", async () => {
    const key = `${TEST_PREFIX}concurrent`;
    const limit = 10;
    const windowSec = 60;

    const results = await Promise.all(
      Array.from({ length: 10 }, () => checkRateLimit(key, limit, windowSec)),
    );

    const okCount = results.filter((r) => r.ok).length;
    expect(okCount).toBe(10);

    const over = await checkRateLimit(key, limit, windowSec);
    expect(over.ok).toBe(false);
  });

  it("happy: different window resets the count", async () => {
    const key = `${TEST_PREFIX}window_reset`;
    const limit = 2;
    const windowSec = 1;

    await checkRateLimit(key, limit, windowSec);
    await checkRateLimit(key, limit, windowSec);

    const blocked = await checkRateLimit(key, limit, windowSec);
    expect(blocked.ok).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 1100));

    const afterReset = await checkRateLimit(key, limit, windowSec);
    expect(afterReset.ok).toBe(true);
  });
});
