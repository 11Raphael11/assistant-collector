import { createRepository } from "../../server/repository";
import { normalizePersian } from "../../lib/text";
import { toLatinDigits } from "../../lib/digits";
import type { Result } from "../../lib/result";
import { ok, err } from "../../lib/result";
import type { CustomerRow } from "./repo";
import { toRow } from "./repo";

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

export interface ListCustomersInput {
  query?: string;
  cursor?: string;
  limit?: number;
}

export interface ListCustomersOutput {
  items: CustomerRow[];
  nextCursor: string | null;
}

function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(
    JSON.stringify({ t: createdAt.toISOString(), i: id }),
  ).toString("base64url");
}

function decodeCursor(
  cursor: string,
): { createdAt: Date; id: string } | null {
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    );
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("t" in parsed) ||
      !("i" in parsed)
    ) {
      return null;
    }
    const obj = parsed as { t: unknown; i: unknown };
    if (typeof obj.t !== "string" || typeof obj.i !== "string") return null;
    const date = new Date(obj.t);
    if (isNaN(date.getTime())) return null;
    return { createdAt: date, id: obj.i };
  } catch {
    return null;
  }
}

export async function listCustomers(
  businessId: string,
  input: ListCustomersInput = {},
): Promise<Result<ListCustomersOutput>> {
  const limit = Math.min(
    Math.max(1, input.limit ?? DEFAULT_LIMIT),
    MAX_LIMIT,
  );

  const repo = createRepository(businessId);

  const where: Record<string, unknown> = {};

  if (input.query) {
    const latin = toLatinDigits(input.query.trim());

    if (/^\d{4}$/.test(latin)) {
      where.phoneLast4 = latin;
    } else {
      const normalized = normalizePersian(toLatinDigits(input.query));
      where.nameNormalized = { contains: normalized };
    }
  }

  if (input.cursor) {
    const decoded = decodeCursor(input.cursor);
    if (!decoded) {
      return err("INVALID_CURSOR", "invalid cursor");
    }
    where.OR = [
      { createdAt: { lt: decoded.createdAt } },
      { createdAt: { equals: decoded.createdAt }, id: { lt: decoded.id } },
    ];
  }

  const rows = await repo.customers.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  const items = page.map(toRow);

  const nextCursor =
    hasMore && page.length > 0
      ? encodeCursor(
          page[page.length - 1].createdAt,
          page[page.length - 1].id,
        )
      : null;

  return ok({ items, nextCursor });
}
