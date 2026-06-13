import { describe, it, expect, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";

describe("Ping model", () => {
  const prisma = new PrismaClient();

  afterAll(async () => {
    await prisma.ping.deleteMany();
    await prisma.$disconnect();
  });

  it("happy: inserts and reads back a Ping row", async () => {
    const created = await prisma.ping.create({
      data: { note: "hello from test" },
    });

    expect(created.id).toBeTruthy();
    expect(created.note).toBe("hello from test");
    expect(created.createdAt).toBeInstanceOf(Date);

    const found = await prisma.ping.findUnique({ where: { id: created.id } });
    expect(found).not.toBeNull();
    expect(found!.note).toBe("hello from test");
  });

  it("edge: connection fails fast with a wrong DATABASE_URL", async () => {
    const badPrisma = new PrismaClient({
      datasources: {
        db: {
          url: "postgresql://nobody:wrong@localhost:59999/nonexistent?connection_limit=10",
        },
      },
    });

    await expect(
      badPrisma.ping.findMany(),
    ).rejects.toThrow();

    await badPrisma.$disconnect();
  });

  it("happy: connection_limit is present in DATABASE_URL", () => {
    const url = process.env["DATABASE_URL"] ?? "";
    expect(url).toContain("connection_limit=10");
  });
});
