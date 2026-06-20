import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.SESSION_SECRET = "test-secret";
process.env.ENCRYPTION_KEY =
  "0000000000000000000000000000000000000000000000000000000000000000";
process.env.BLIND_INDEX_KEY =
  "1111111111111111111111111111111111111111111111111111111111111111";
process.env.CRON_SECRET = "test-cron";

import { normalizePersian } from "../../lib/text";

const mockFindMany = vi.fn();

vi.mock("@/server/repository", () => ({
  createRepository: (businessId: string) => ({
    businessId,
    customers: {
      create: vi.fn(),
      findById: vi.fn(),
      findMany: (args: unknown) => mockFindMany(args),
      update: vi.fn(),
    },
    contracts: {},
    installments: {},
  }),
}));

import { listCustomers } from "./list";

function fakeCustomer(
  id: string,
  name: string,
  phoneLast4: string,
  createdAt: Date,
) {
  return {
    id,
    businessId: "biz-1",
    name,
    nameNormalized: normalizePersian(name),
    phoneEnc: Buffer.from("encrypted", "utf8"),
    phoneHash: "hash-" + id,
    phoneLast4,
    nationalIdEnc: null,
    nationalIdHash: null,
    note: null,
    createdAt,
    deletedAt: null,
  };
}

describe("listCustomers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("happy: searching 'علي' (Arabic ye) finds a customer stored as 'علی'", async () => {
    const ali = fakeCustomer(
      "c1",
      "علی رضایی",
      "6789",
      new Date("2025-01-01"),
    );
    mockFindMany.mockResolvedValue([ali]);

    const result = await listCustomers("biz-1", { query: "علي" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.items).toHaveLength(1);
    expect(result.value.items[0].name).toBe("علی رضایی");

    const callArgs = mockFindMany.mock.calls[0][0];
    const normalized = normalizePersian("علي");
    expect(callArgs.where.nameNormalized).toEqual({ contains: normalized });
  });

  it("happy: searching last-4 digits finds the right one", async () => {
    const customer = fakeCustomer(
      "c2",
      "سارا محمدی",
      "1234",
      new Date("2025-02-01"),
    );
    mockFindMany.mockResolvedValue([customer]);

    const result = await listCustomers("biz-1", { query: "1234" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.items).toHaveLength(1);
    expect(result.value.items[0].phoneLast4).toBe("1234");

    const callArgs = mockFindMany.mock.calls[0][0];
    expect(callArgs.where.phoneLast4).toBe("1234");
  });

  it("happy: Persian digits in query are converted to Latin for phoneLast4 search", async () => {
    mockFindMany.mockResolvedValue([]);

    await listCustomers("biz-1", { query: "۱۲۳۴" });

    const callArgs = mockFindMany.mock.calls[0][0];
    expect(callArgs.where.phoneLast4).toBe("1234");
  });

  it("happy: following the cursor returns the next page without overlap", async () => {
    const page1 = [
      fakeCustomer("c3", "مشتری یک", "1111", new Date("2025-03-01")),
      fakeCustomer("c4", "مشتری دو", "2222", new Date("2025-02-01")),
      fakeCustomer("extra", "اضافه", "3333", new Date("2025-01-15")),
    ];
    mockFindMany.mockResolvedValueOnce(page1);

    const r1 = await listCustomers("biz-1", { limit: 2 });
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    expect(r1.value.items).toHaveLength(2);
    expect(r1.value.nextCursor).toBeTruthy();

    const page2 = [
      fakeCustomer("c5", "مشتری سه", "4444", new Date("2025-01-01")),
    ];
    mockFindMany.mockResolvedValueOnce(page2);

    const r2 = await listCustomers("biz-1", {
      limit: 2,
      cursor: r1.value.nextCursor!,
    });

    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect(r2.value.items).toHaveLength(1);
    expect(r2.value.nextCursor).toBeNull();

    const cursorCallArgs = mockFindMany.mock.calls[1][0];
    expect(cursorCallArgs.where.OR).toBeDefined();
    expect(cursorCallArgs.where.OR).toHaveLength(2);
  });

  it("edge: empty query lists page-1 with a nextCursor", async () => {
    const customers = Array.from({ length: 21 }, (_, i) =>
      fakeCustomer(
        `c${i}`,
        `مشتری ${i}`,
        String(i).padStart(4, "0"),
        new Date(2025, 0, 21 - i),
      ),
    );
    mockFindMany.mockResolvedValue(customers);

    const result = await listCustomers("biz-1", {});

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.items).toHaveLength(20);
    expect(result.value.nextCursor).toBeTruthy();

    const callArgs = mockFindMany.mock.calls[0][0];
    expect(callArgs.where).toEqual({});
    expect(callArgs.take).toBe(21);
    expect(callArgs.orderBy).toEqual({ createdAt: "desc" });
  });

  it("edge: limit over cap is clamped (e.g. 50)", async () => {
    mockFindMany.mockResolvedValue([]);

    await listCustomers("biz-1", { limit: 100 });

    const callArgs = mockFindMany.mock.calls[0][0];
    expect(callArgs.take).toBe(51);
  });

  it("edge: limit below 1 is clamped to 1", async () => {
    mockFindMany.mockResolvedValue([]);

    await listCustomers("biz-1", { limit: 0 });

    const callArgs = mockFindMany.mock.calls[0][0];
    expect(callArgs.take).toBe(2);
  });

  it("edge: invalid cursor returns INVALID_CURSOR error", async () => {
    const result = await listCustomers("biz-1", { cursor: "not-valid" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_CURSOR");
  });

  it("edge: no results returns empty items and null cursor", async () => {
    mockFindMany.mockResolvedValue([]);

    const result = await listCustomers("biz-1", { query: "nonexistent" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.items).toHaveLength(0);
    expect(result.value.nextCursor).toBeNull();
  });
});
