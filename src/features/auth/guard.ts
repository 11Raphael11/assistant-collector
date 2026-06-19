import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { readSession, type SessionData } from "@/server/session";
import { createRepository, type ScopedRepository } from "@/server/repository";
import { type Result, err } from "@/lib/result";

const SESSION_COOKIE = "sid";

export async function getSession(): Promise<Result<SessionData>> {
  const jar = await cookies();
  const cookie = jar.get(SESSION_COOKIE);

  if (!cookie?.value) {
    return err("NO_SESSION", "no session cookie");
  }

  return readSession(cookie.value);
}

export async function requireSession(): Promise<SessionData> {
  const result = await getSession();

  if (!result.ok) {
    redirect("/login");
  }

  return result.value;
}

export async function requireSessionApi(): Promise<
  Result<SessionData>
> {
  const result = await getSession();
  if (!result.ok) {
    return err("UNAUTHORIZED", "authentication required");
  }
  return result;
}

export async function getRepo(): Promise<ScopedRepository> {
  const session = await requireSession();
  return createRepository(session.businessId);
}

export async function getRepoApi(): Promise<
  Result<ScopedRepository>
> {
  const result = await requireSessionApi();
  if (!result.ok) return result;
  return { ok: true, value: createRepository(result.value.businessId) };
}
