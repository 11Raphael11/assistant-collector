import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { prisma } from "./db";
import { createSession, readSession, destroySession, rotateSession } from "./session";

let testBusinessId: string;
let testUserId: string;

async function cleanup(): Promise<void> {
  await prisma.session.deleteMany({
    where: { userId: testUserId },
  });
}

async function setupFixtures(): Promise<void> {
  const business = await prisma.business.create({
    data: { name: "Test Business", type: "shop" },
  });
  testBusinessId = business.id;

  const user = await prisma.user.create({
    data: {
      businessId: testBusinessId,
      phoneEnc: Buffer.from("test"),
      phoneHash: `session_test_${Date.now()}`,
      phoneLast4: "1234",
      passwordHash: "$2a$12$fakehashfakehashfakehashfakehashfakehashfakehashfa",
      role: "owner",
      sessionVersion: 0,
    },
  });
  testUserId = user.id;
}

async function teardownFixtures(): Promise<void> {
  await prisma.session.deleteMany({ where: { userId: testUserId } });
  await prisma.user.deleteMany({ where: { id: testUserId } });
  await prisma.business.deleteMany({ where: { id: testBusinessId } });
}

describe("server/session", () => {
  beforeAll(async () => {
    await setupFixtures();
  });

  beforeEach(async () => {
    await cleanup();
  });

  afterAll(async () => {
    await teardownFixtures();
    await prisma.$disconnect();
  });

  it("happy: create → read returns {userId, businessId}", async () => {
    const createResult = await createSession(testUserId, testBusinessId);
    expect(createResult.ok).toBe(true);
    if (!createResult.ok) return;

    const cookie = createResult.value;
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.secure).toBe(true);
    expect(cookie.sameSite).toBe("strict");
    expect(cookie.path).toBe("/");

    const readResult = await readSession(cookie.value);
    expect(readResult.ok).toBe(true);
    if (!readResult.ok) return;

    expect(readResult.value.userId).toBe(testUserId);
    expect(readResult.value.businessId).toBe(testBusinessId);
  });

  it("edge (#19): bumping User.sessionVersion invalidates readSession", async () => {
    const createResult = await createSession(testUserId, testBusinessId);
    expect(createResult.ok).toBe(true);
    if (!createResult.ok) return;

    const cookie = createResult.value;

    await prisma.user.update({
      where: { id: testUserId },
      data: { sessionVersion: { increment: 1 } },
    });

    const readResult = await readSession(cookie.value);
    expect(readResult.ok).toBe(false);
    if (!readResult.ok) {
      expect(readResult.error.code).toBe("INVALID_SESSION");
    }

    await prisma.user.update({
      where: { id: testUserId },
      data: { sessionVersion: 0 },
    });
  });

  it("edge: tampered cookie returns null/error", async () => {
    const readResult = await readSession("tampered.invalidsignature");
    expect(readResult.ok).toBe(false);
    if (!readResult.ok) {
      expect(readResult.error.code).toBe("INVALID_SESSION");
    }
  });

  it("edge: malformed cookie (no dot) returns error", async () => {
    const readResult = await readSession("nodothere");
    expect(readResult.ok).toBe(false);
  });

  it("happy: cookie flags are HttpOnly+Strict+Secure", async () => {
    const createResult = await createSession(testUserId, testBusinessId);
    expect(createResult.ok).toBe(true);
    if (!createResult.ok) return;

    const cookie = createResult.value;
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.secure).toBe(true);
    expect(cookie.sameSite).toBe("strict");
  });

  it("happy: rotation yields a different id but same identity", async () => {
    const createResult = await createSession(testUserId, testBusinessId);
    expect(createResult.ok).toBe(true);
    if (!createResult.ok) return;

    const oldCookie = createResult.value;

    const rotateResult = await rotateSession(oldCookie.value);
    expect(rotateResult.ok).toBe(true);
    if (!rotateResult.ok) return;

    const newCookie = rotateResult.value;
    expect(newCookie.value).not.toBe(oldCookie.value);

    const readResult = await readSession(newCookie.value);
    expect(readResult.ok).toBe(true);
    if (!readResult.ok) return;

    expect(readResult.value.userId).toBe(testUserId);
    expect(readResult.value.businessId).toBe(testBusinessId);

    const oldReadResult = await readSession(oldCookie.value);
    expect(oldReadResult.ok).toBe(false);
  });

  it("happy: destroySession invalidates the session", async () => {
    const createResult = await createSession(testUserId, testBusinessId);
    expect(createResult.ok).toBe(true);
    if (!createResult.ok) return;

    const cookie = createResult.value;

    const destroyResult = await destroySession(cookie.value);
    expect(destroyResult.ok).toBe(true);
    if (!destroyResult.ok) return;
    expect(destroyResult.value.maxAge).toBe(0);

    const readResult = await readSession(cookie.value);
    expect(readResult.ok).toBe(false);
  });

  it("edge: createSession for non-existent user returns error", async () => {
    const result = await createSession("nonexistent_user_id", testBusinessId);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("USER_NOT_FOUND");
    }
  });
});
