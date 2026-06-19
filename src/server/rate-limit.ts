import { prisma } from "./db";
import { ok, err, type Result } from "../lib/result";

export async function checkRateLimit(
  key: string,
  limit: number,
  windowSec: number,
): Promise<Result<void>> {
  const windowMs = windowSec * 1000;
  const now = Date.now();
  const windowStart = new Date(now - (now % windowMs));

  const [row] = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateBucket" ("key", "windowStart", "count")
    VALUES (${key}, ${windowStart}, 1)
    ON CONFLICT ("key", "windowStart")
    DO UPDATE SET "count" = "RateBucket"."count" + 1
    RETURNING "count"
  `;

  if (row.count > limit) {
    return err("RATE_LIMITED", `Rate limit exceeded for key: ${key}`);
  }

  return ok(undefined);
}
