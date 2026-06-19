import { createHmac, randomBytes } from "node:crypto";
import { prisma } from "./db";
import { ok, err, type Result } from "../lib/result";
import { env } from "../lib/env";

const SESSION_COOKIE = "sid";
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface SessionData {
  userId: string;
  businessId: string;
}

export interface CookieOptions {
  name: string;
  value: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "strict";
  path: string;
  maxAge: number;
}

function sign(sessionId: string): string {
  const hmac = createHmac("sha256", env.SESSION_SECRET)
    .update(sessionId)
    .digest("hex");
  return `${sessionId}.${hmac}`;
}

function unsign(cookie: string): Result<string> {
  const dotIdx = cookie.lastIndexOf(".");
  if (dotIdx === -1) {
    return err("INVALID_SESSION", "malformed cookie");
  }
  const sessionId = cookie.slice(0, dotIdx);
  const expected = sign(sessionId);
  if (cookie !== expected) {
    return err("INVALID_SESSION", "tampered cookie");
  }
  return ok(sessionId);
}

function buildCookie(signedValue: string): CookieOptions {
  return {
    name: SESSION_COOKIE,
    value: signedValue,
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: Math.floor(SESSION_MAX_AGE_MS / 1000),
  };
}

export async function createSession(
  userId: string,
  businessId: string,
): Promise<Result<CookieOptions>> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { sessionVersion: true },
  });

  if (!user) {
    return err("USER_NOT_FOUND", "user does not exist");
  }

  const id = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_MS);

  await prisma.session.create({
    data: {
      id,
      userId,
      businessId,
      sessionVersion: user.sessionVersion,
      expiresAt,
    },
  });

  return ok(buildCookie(sign(id)));
}

export async function readSession(
  cookieValue: string,
): Promise<Result<SessionData>> {
  const parsed = unsign(cookieValue);
  if (!parsed.ok) return parsed;

  const session = await prisma.session.findUnique({
    where: { id: parsed.value },
    include: { user: { select: { sessionVersion: true } } },
  });

  if (!session) {
    return err("INVALID_SESSION", "session not found");
  }

  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } });
    return err("INVALID_SESSION", "session expired");
  }

  if (session.sessionVersion !== session.user.sessionVersion) {
    await prisma.session.delete({ where: { id: session.id } });
    return err("INVALID_SESSION", "session version mismatch");
  }

  return ok({ userId: session.userId, businessId: session.businessId });
}

export async function destroySession(
  cookieValue: string,
): Promise<Result<CookieOptions>> {
  const parsed = unsign(cookieValue);
  if (!parsed.ok) return parsed;

  await prisma.session.deleteMany({ where: { id: parsed.value } });

  return ok({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}

export async function rotateSession(
  cookieValue: string,
): Promise<Result<CookieOptions>> {
  const parsed = unsign(cookieValue);
  if (!parsed.ok) return parsed;

  const existing = await prisma.session.findUnique({
    where: { id: parsed.value },
    include: { user: { select: { sessionVersion: true } } },
  });

  if (!existing) {
    return err("INVALID_SESSION", "session not found");
  }

  if (existing.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: existing.id } });
    return err("INVALID_SESSION", "session expired");
  }

  if (existing.sessionVersion !== existing.user.sessionVersion) {
    await prisma.session.delete({ where: { id: existing.id } });
    return err("INVALID_SESSION", "session version mismatch");
  }

  const newId = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_MS);

  await prisma.$transaction([
    prisma.session.delete({ where: { id: existing.id } }),
    prisma.session.create({
      data: {
        id: newId,
        userId: existing.userId,
        businessId: existing.businessId,
        sessionVersion: existing.sessionVersion,
        expiresAt,
      },
    }),
  ]);

  return ok(buildCookie(sign(newId)));
}
