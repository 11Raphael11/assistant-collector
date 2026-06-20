import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "node:child_process";
import { prisma } from "./db";
import {
  seed,
  DEMO_BUSINESS_ID,
  DEMO_PLAN_ID,
  DEMO_SUBSCRIPTION_ID,
  DEMO_OWNER_USER_ID,
  DEMO_CUSTOMERS,
  DEMO_CONTRACT_A_ID,
  DEMO_CONTRACT_B_ID,
} from "../../prisma/seed";
import { normalizePhone } from "../lib/phone";
import { blindIndex } from "../lib/crypto";

async function cleanupDemoRows(): Promise<void> {
  await prisma.installment.deleteMany({ where: { businessId: DEMO_BUSINESS_ID } });
  await prisma.contract.deleteMany({ where: { businessId: DEMO_BUSINESS_ID } });
  await prisma.customer.deleteMany({ where: { businessId: DEMO_BUSINESS_ID } });
  await prisma.user.deleteMany({ where: { businessId: DEMO_BUSINESS_ID } });
  await prisma.subscription.deleteMany({ where: { businessId: DEMO_BUSINESS_ID } });
  await prisma.business.deleteMany({ where: { id: DEMO_BUSINESS_ID } });
  await prisma.plan.deleteMany({ where: { id: DEMO_PLAN_ID } });
}

describe("prisma/seed", () => {
  beforeAll(async () => {
    await cleanupDemoRows();
  });

  afterAll(async () => {
    await cleanupDemoRows();
    await prisma.$disconnect();
  });

  it("happy: seeding inserts business + plan + subscription + owner + customers + contracts + installments with util-derived PII", async () => {
    await seed();

    const business = await prisma.business.findUnique({
      where: { id: DEMO_BUSINESS_ID },
    });
    expect(business).not.toBeNull();

    const plan = await prisma.plan.findUnique({ where: { id: DEMO_PLAN_ID } });
    expect(plan).not.toBeNull();
    expect(plan!.customerCap).toBe(100);

    const subscription = await prisma.subscription.findUnique({
      where: { id: DEMO_SUBSCRIPTION_ID },
    });
    expect(subscription).not.toBeNull();
    expect(subscription!.businessId).toBe(DEMO_BUSINESS_ID);
    expect(subscription!.planId).toBe(DEMO_PLAN_ID);
    expect(subscription!.status).toBe("active");

    const owner = await prisma.user.findUnique({
      where: { id: DEMO_OWNER_USER_ID },
    });
    expect(owner).not.toBeNull();
    expect(owner!.role).toBe("owner");

    const customers = await prisma.customer.findMany({
      where: { businessId: DEMO_BUSINESS_ID },
      orderBy: { id: "asc" },
    });
    expect(customers).toHaveLength(DEMO_CUSTOMERS.length);

    // Verify PII fields were filled via the real utils — phoneHash must match
    // blindIndex(normalizePhone(raw)) exactly, otherwise lookups will fail.
    for (const seedCustomer of DEMO_CUSTOMERS) {
      const normalized = normalizePhone(seedCustomer.rawPhone);
      expect(normalized.ok).toBe(true);
      if (!normalized.ok) return;
      const expectedHash = blindIndex(normalized.value);
      const expectedLast4 = normalized.value.slice(-4);

      const c = customers.find((x) => x.id === seedCustomer.id);
      expect(c).toBeDefined();
      expect(c!.phoneHash).toBe(expectedHash);
      expect(c!.phoneLast4).toBe(expectedLast4);
      expect(c!.phoneEnc.length).toBeGreaterThan(0);
      expect(c!.nameNormalized.length).toBeGreaterThan(0);
    }

    const contracts = await prisma.contract.findMany({
      where: { businessId: DEMO_BUSINESS_ID },
    });
    expect(contracts.map((c) => c.id).sort()).toEqual(
      [DEMO_CONTRACT_A_ID, DEMO_CONTRACT_B_ID].sort(),
    );

    const installments = await prisma.installment.findMany({
      where: { businessId: DEMO_BUSINESS_ID },
    });
    expect(installments.length).toBeGreaterThanOrEqual(8);

    // Varied statuses present
    const statuses = new Set(installments.map((i) => i.status));
    expect(statuses.has("paid")).toBe(true);
    expect(statuses.has("pending")).toBe(true);
    expect(statuses.size).toBeGreaterThanOrEqual(3);
  });

  it("edge: running the seed twice is idempotent — counts stay the same and no unique-key error is thrown", async () => {
    await seed();
    const businessesAfterFirst = await prisma.business.count({
      where: { id: DEMO_BUSINESS_ID },
    });
    const customersAfterFirst = await prisma.customer.count({
      where: { businessId: DEMO_BUSINESS_ID },
    });
    const installmentsAfterFirst = await prisma.installment.count({
      where: { businessId: DEMO_BUSINESS_ID },
    });

    await expect(seed()).resolves.not.toThrow();

    const businessesAfterSecond = await prisma.business.count({
      where: { id: DEMO_BUSINESS_ID },
    });
    const customersAfterSecond = await prisma.customer.count({
      where: { businessId: DEMO_BUSINESS_ID },
    });
    const installmentsAfterSecond = await prisma.installment.count({
      where: { businessId: DEMO_BUSINESS_ID },
    });

    expect(businessesAfterSecond).toBe(businessesAfterFirst);
    expect(customersAfterSecond).toBe(customersAfterFirst);
    expect(installmentsAfterSecond).toBe(installmentsAfterFirst);
  });

  it("happy: `pnpm prisma db seed` CLI runs successfully and the demo business is present", { timeout: 30_000 }, async () => {
    await cleanupDemoRows();
    execSync("pnpm prisma db seed", {
      cwd: process.cwd(),
      stdio: "pipe",
    });
    const business = await prisma.business.findUnique({
      where: { id: DEMO_BUSINESS_ID },
    });
    expect(business).not.toBeNull();
  });
});
