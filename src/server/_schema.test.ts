import { describe, it, expect, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";

describe("Business model", () => {
  const prisma = new PrismaClient();

  afterAll(async () => {
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
});
