import { describe, it, expect, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";

describe("Business model", () => {
  const prisma = new PrismaClient();

  afterAll(async () => {
    await prisma.contract.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.user.deleteMany();
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

  it("happy: create a User under a Business with PII triple, role and default sessionVersion=0", async () => {
    const business = await prisma.business.create({
      data: { name: "User Shop", type: "retail" },
    });

    const phoneEnc = Buffer.from("encrypted-phone-bytes-1", "utf8");
    const phoneHash = "hash_happy_user_1";

    const user = await prisma.user.create({
      data: {
        businessId: business.id,
        phoneEnc,
        phoneHash,
        phoneLast4: "1234",
        passwordHash: "bcrypt$dummy$hash",
        role: "owner",
      },
    });

    expect(user.id).toBeTruthy();
    expect(user.businessId).toBe(business.id);
    expect(Buffer.from(user.phoneEnc).equals(phoneEnc)).toBe(true);
    expect(user.phoneHash).toBe(phoneHash);
    expect(user.phoneLast4).toBe("1234");
    expect(user.passwordHash).toBe("bcrypt$dummy$hash");
    expect(user.role).toBe("owner");
    expect(user.sessionVersion).toBe(0);
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.updatedAt).toBeInstanceOf(Date);

    const withBusiness = await prisma.user.findUnique({
      where: { id: user.id },
      include: { business: true },
    });
    expect(withBusiness).not.toBeNull();
    expect(withBusiness!.business.id).toBe(business.id);
  });

  it("edge: a second User with the same phoneHash violates the UNIQUE constraint", async () => {
    const business = await prisma.business.create({
      data: { name: "Unique Phone Shop", type: "retail" },
    });

    const phoneHash = "hash_edge_duplicate_1";

    await prisma.user.create({
      data: {
        businessId: business.id,
        phoneEnc: Buffer.from("enc-a", "utf8"),
        phoneHash,
        phoneLast4: "9999",
        passwordHash: "bcrypt$dummy$a",
        role: "owner",
      },
    });

    await expect(
      prisma.user.create({
        data: {
          businessId: business.id,
          phoneEnc: Buffer.from("enc-b", "utf8"),
          phoneHash,
          phoneLast4: "9999",
          passwordHash: "bcrypt$dummy$b",
          role: "staff",
        },
      }),
    ).rejects.toThrow();
  });

  it("happy: two Businesses may each have a Customer with the same phoneHash (uniqueness is per-business)", async () => {
    const businessA = await prisma.business.create({
      data: { name: "Customer Shop A", type: "retail" },
    });
    const businessB = await prisma.business.create({
      data: { name: "Customer Shop B", type: "retail" },
    });

    const phoneHash = "hash_shared_across_businesses";

    const customerA = await prisma.customer.create({
      data: {
        businessId: businessA.id,
        name: "علی رضایی",
        nameNormalized: "علی رضایی",
        phoneEnc: Buffer.from("enc-a", "utf8"),
        phoneHash,
        phoneLast4: "1111",
      },
    });

    const customerB = await prisma.customer.create({
      data: {
        businessId: businessB.id,
        name: "محمد احمدی",
        nameNormalized: "محمد احمدی",
        phoneEnc: Buffer.from("enc-b", "utf8"),
        phoneHash,
        phoneLast4: "1111",
      },
    });

    expect(customerA.id).toBeTruthy();
    expect(customerB.id).toBeTruthy();
    expect(customerA.businessId).not.toBe(customerB.businessId);
    expect(customerA.phoneHash).toBe(customerB.phoneHash);
    expect(customerA.nationalIdEnc).toBeNull();
    expect(customerA.nationalIdHash).toBeNull();
    expect(customerA.note).toBeNull();
    expect(customerA.deletedAt).toBeNull();
    expect(customerA.createdAt).toBeInstanceOf(Date);
  });

  it("edge: a duplicate (businessId, phoneHash) within one business violates the composite UNIQUE", async () => {
    const business = await prisma.business.create({
      data: { name: "Customer Unique Shop", type: "retail" },
    });

    const phoneHash = "hash_customer_duplicate_1";

    await prisma.customer.create({
      data: {
        businessId: business.id,
        name: "زهرا کریمی",
        nameNormalized: "زهرا کریمی",
        phoneEnc: Buffer.from("enc-1", "utf8"),
        phoneHash,
        phoneLast4: "2222",
      },
    });

    await expect(
      prisma.customer.create({
        data: {
          businessId: business.id,
          name: "زهرا کریمی دوم",
          nameNormalized: "زهرا کریمی دوم",
          phoneEnc: Buffer.from("enc-2", "utf8"),
          phoneHash,
          phoneLast4: "2222",
        },
      }),
    ).rejects.toThrow();
  });

  it("happy: create a Contract for a Customer with integer Rial fields and default status=active", async () => {
    const business = await prisma.business.create({
      data: { name: "Contract Shop", type: "retail" },
    });

    const customer = await prisma.customer.create({
      data: {
        businessId: business.id,
        name: "حسین موسوی",
        nameNormalized: "حسین موسوی",
        phoneEnc: Buffer.from("enc-c-1", "utf8"),
        phoneHash: "hash_contract_happy_1",
        phoneLast4: "3333",
      },
    });

    const startDate = new Date("2026-01-15T00:00:00.000Z");
    const contract = await prisma.contract.create({
      data: {
        businessId: business.id,
        customerId: customer.id,
        totalAmountRial: 120_000_000,
        downPaymentRial: 20_000_000,
        installmentCount: 10,
        intervalMonths: 1,
        startDate,
      },
    });

    expect(contract.id).toBeTruthy();
    expect(contract.businessId).toBe(business.id);
    expect(contract.customerId).toBe(customer.id);
    expect(Number.isInteger(contract.totalAmountRial)).toBe(true);
    expect(Number.isInteger(contract.downPaymentRial)).toBe(true);
    expect(contract.totalAmountRial).toBe(120_000_000);
    expect(contract.downPaymentRial).toBe(20_000_000);
    expect(contract.installmentCount).toBe(10);
    expect(contract.intervalMonths).toBe(1);
    expect(contract.startDate.toISOString()).toBe(startDate.toISOString());
    expect(contract.status).toBe("active");
    expect(contract.deletedAt).toBeNull();
    expect(contract.createdAt).toBeInstanceOf(Date);

    const withRelations = await prisma.contract.findUnique({
      where: { id: contract.id },
      include: { business: true, customer: true },
    });
    expect(withRelations).not.toBeNull();
    expect(withRelations!.business.id).toBe(business.id);
    expect(withRelations!.customer.id).toBe(customer.id);
  });

  it("edge: a Contract referencing a non-existent customerId violates the FK constraint", async () => {
    // NOTE: A Contract whose customerId belongs to a different business is allowed
    // at the DB level by design — the (businessId, customerId) scope guard is the
    // repository's responsibility, not Postgres'. Here we assert that the FK on
    // customerId itself does exist by attempting to create with a bogus id.
    const business = await prisma.business.create({
      data: { name: "Contract FK Shop", type: "retail" },
    });

    await expect(
      prisma.contract.create({
        data: {
          businessId: business.id,
          customerId: "customer_does_not_exist",
          totalAmountRial: 50_000_000,
          downPaymentRial: 0,
          installmentCount: 5,
          intervalMonths: 1,
          startDate: new Date("2026-02-01T00:00:00.000Z"),
        },
      }),
    ).rejects.toThrow();
  });
});
