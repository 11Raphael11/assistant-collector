import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "./db";
import { createRepository } from "./repository";
import { encryptPII, blindIndex, last4 } from "../lib/crypto";
import { normalizePhone } from "../lib/phone";
import { normalizePersian } from "../lib/text";

const BIZ_A = "test_repo_biz_a";
const BIZ_B = "test_repo_biz_b";

function buildPii(rawPhone: string): {
  phoneEnc: Buffer;
  phoneHash: string;
  phoneLast4: string;
} {
  const n = normalizePhone(rawPhone);
  if (!n.ok) throw new Error("invalid phone for test fixture");
  return {
    phoneEnc: Buffer.from(encryptPII(n.value), "utf8"),
    phoneHash: blindIndex(n.value),
    phoneLast4: last4(n.value),
  };
}

async function cleanup(): Promise<void> {
  await prisma.installment.deleteMany({
    where: { businessId: { in: [BIZ_A, BIZ_B] } },
  });
  await prisma.contract.deleteMany({
    where: { businessId: { in: [BIZ_A, BIZ_B] } },
  });
  await prisma.customer.deleteMany({
    where: { businessId: { in: [BIZ_A, BIZ_B] } },
  });
  await prisma.business.deleteMany({ where: { id: { in: [BIZ_A, BIZ_B] } } });
}

describe("server/repository createRepository (anti-IDOR tenant scope)", () => {
  beforeAll(async () => {
    await cleanup();
    await prisma.business.create({
      data: { id: BIZ_A, name: "Biz A", type: "retail" },
    });
    await prisma.business.create({
      data: { id: BIZ_B, name: "Biz B", type: "retail" },
    });
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("happy: A's repo creates and reads back A's customer by id", async () => {
    const repoA = createRepository(BIZ_A);
    const pii = buildPii("09120000111");
    const created = await repoA.customers.create({
      name: "علی رضایی",
      nameNormalized: normalizePersian("علی رضایی"),
      phoneEnc: pii.phoneEnc,
      phoneHash: pii.phoneHash,
      phoneLast4: pii.phoneLast4,
    });
    expect(created.businessId).toBe(BIZ_A);

    const fetched = await repoA.customers.findById(created.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.id).toBe(created.id);
    expect(fetched?.businessId).toBe(BIZ_A);

    const list = await repoA.customers.findMany();
    expect(list.every((c) => c.businessId === BIZ_A)).toBe(true);
    expect(list.find((c) => c.id === created.id)).toBeDefined();
  });

  it("edge: A's repo cannot read B's customer by id — returns null (bug #3 IDOR)", async () => {
    const repoB = createRepository(BIZ_B);
    const pii = buildPii("09120000222");
    const bCustomer = await repoB.customers.create({
      name: "زهرا کریمی",
      nameNormalized: normalizePersian("زهرا کریمی"),
      phoneEnc: pii.phoneEnc,
      phoneHash: pii.phoneHash,
      phoneLast4: pii.phoneLast4,
    });
    expect(bCustomer.businessId).toBe(BIZ_B);

    const repoA = createRepository(BIZ_A);
    const crossRead = await repoA.customers.findById(bCustomer.id);
    expect(crossRead).toBeNull();

    const listA = await repoA.customers.findMany();
    expect(listA.find((c) => c.id === bCustomer.id)).toBeUndefined();
  });

  it("edge: spoofed businessId in create payload is overridden to A (bug #3 IDOR)", async () => {
    const repoA = createRepository(BIZ_A);
    const pii = buildPii("09120000333");
    const created = await repoA.customers.create({
      businessId: BIZ_B,
      name: "حسین موسوی",
      nameNormalized: normalizePersian("حسین موسوی"),
      phoneEnc: pii.phoneEnc,
      phoneHash: pii.phoneHash,
      phoneLast4: pii.phoneLast4,
    });
    expect(created.businessId).toBe(BIZ_A);

    const repoB = createRepository(BIZ_B);
    const bSeesIt = await repoB.customers.findById(created.id);
    expect(bSeesIt).toBeNull();
  });

  it("edge: soft-deleted customers are excluded from findById and findMany", async () => {
    const repoA = createRepository(BIZ_A);
    const pii = buildPii("09120000444");
    const created = await repoA.customers.create({
      name: "نرگس صادقی",
      nameNormalized: normalizePersian("نرگس صادقی"),
      phoneEnc: pii.phoneEnc,
      phoneHash: pii.phoneHash,
      phoneLast4: pii.phoneLast4,
    });
    await prisma.customer.update({
      where: { id: created.id },
      data: { deletedAt: new Date() },
    });
    expect(await repoA.customers.findById(created.id)).toBeNull();
    const list = await repoA.customers.findMany();
    expect(list.find((c) => c.id === created.id)).toBeUndefined();
  });

  it("edge: update for a cross-tenant id returns null and does not mutate the row", async () => {
    const repoB = createRepository(BIZ_B);
    const pii = buildPii("09120000555");
    const bCustomer = await repoB.customers.create({
      name: "رضا قاسمی",
      nameNormalized: normalizePersian("رضا قاسمی"),
      phoneEnc: pii.phoneEnc,
      phoneHash: pii.phoneHash,
      phoneLast4: pii.phoneLast4,
    });
    const repoA = createRepository(BIZ_A);
    const updated = await repoA.customers.update(bCustomer.id, {
      name: "HACKED",
    });
    expect(updated).toBeNull();
    const stillB = await prisma.customer.findUnique({
      where: { id: bCustomer.id },
    });
    expect(stillB?.name).toBe("رضا قاسمی");
    expect(stillB?.businessId).toBe(BIZ_B);
  });

  it("edge: createRepository throws on empty businessId", () => {
    expect(() => createRepository("")).toThrow();
  });
});
