import { describe, it, expect, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";

describe("Business model", () => {
  const prisma = new PrismaClient();

  afterAll(async () => {
    await prisma.subscription.deleteMany();
    await prisma.plan.deleteMany();
    await prisma.business.deleteMany();
    await prisma.$disconnect();
  });

  it("happy: inserts a Business with required fields and defaults are applied", async () => {
    const created = await prisma.business.create({
      data: {
        name: "Test Shop",
        type: "retail",
      },
    });

    expect(created.id).toBeTruthy();
    expect(created.name).toBe("Test Shop");
    expect(created.type).toBe("retail");
    expect(created.smsCreditBalance).toBe(0);
    expect(created.brandColor).toBeNull();
    expect(created.logoUrl).toBeNull();
    expect(created.supportPhone).toBeNull();
    expect(created.deletedAt).toBeNull();
    expect(created.createdAt).toBeInstanceOf(Date);
    expect(created.updatedAt).toBeInstanceOf(Date);

    const found = await prisma.business.findUnique({ where: { id: created.id } });
    expect(found).not.toBeNull();
    expect(found!.smsCreditBalance).toBe(0);
    expect(found!.deletedAt).toBeNull();
  });

  it("edge: creating a Business without name fails because the column is NOT NULL", async () => {
    await expect(
      prisma.business.create({
        // @ts-expect-error intentionally missing required `name` to assert the NOT NULL constraint
        data: { type: "retail" },
      }),
    ).rejects.toThrow();
  });

  it("happy: Ping model has been removed from the Prisma client", () => {
    expect(
      (prisma as unknown as Record<string, unknown>)["ping"],
    ).toBeUndefined();
  });

  it("happy: create a Plan + Subscription for a Business and relations resolve", async () => {
    const business = await prisma.business.create({
      data: { name: "Sub Shop", type: "retail" },
    });

    const plan = await prisma.plan.create({
      data: {
        name: "Starter",
        customerCap: 100,
        smsQuota: 500,
        monthlyPriceRial: 1_000_000,
        features: { portal: true, ai: false },
      },
    });

    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + 30 * 24 * 60 * 60 * 1000);

    const subscription = await prisma.subscription.create({
      data: {
        businessId: business.id,
        planId: plan.id,
        status: "active",
        startsAt,
        endsAt,
      },
    });

    expect(subscription.id).toBeTruthy();
    expect(subscription.businessId).toBe(business.id);
    expect(subscription.planId).toBe(plan.id);
    expect(subscription.status).toBe("active");
    expect(subscription.endsAt).toEqual(endsAt);
    expect(subscription.graceUntil).toBeNull();

    const withRelations = await prisma.subscription.findUnique({
      where: { id: subscription.id },
      include: { business: true, plan: true },
    });
    expect(withRelations).not.toBeNull();
    expect(withRelations!.business.id).toBe(business.id);
    expect(withRelations!.plan.id).toBe(plan.id);
    expect(withRelations!.plan.customerCap).toBe(100);
    expect(withRelations!.plan.features).toEqual({ portal: true, ai: false });
  });

  it("edge: a Subscription referencing a non-existent Plan fails the FK constraint", async () => {
    const business = await prisma.business.create({
      data: { name: "FK Shop", type: "retail" },
    });

    await expect(
      prisma.subscription.create({
        data: {
          businessId: business.id,
          planId: "plan_does_not_exist",
          status: "active",
          startsAt: new Date(),
        },
      }),
    ).rejects.toThrow();
  });
});
