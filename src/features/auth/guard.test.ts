import { describe, it, expect, vi, beforeEach } from "vitest";

let mockCookieStore: Map<string, { value: string }>;
let mockReadSession: ReturnType<typeof vi.fn>;
let mockRedirect: ReturnType<typeof vi.fn>;

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => mockCookieStore.get(name) ?? undefined,
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    mockRedirect(url);
    throw new Error(`REDIRECT:${url}`);
  },
}));

vi.mock("@/server/session", () => ({
  readSession: (...args: unknown[]) => mockReadSession(...args),
}));

vi.mock("@/server/repository", () => ({
  createRepository: (businessId: string) => ({
    businessId,
    customers: {},
    contracts: {},
    installments: {},
  }),
}));

import { getSession, requireSession, requireSessionApi, getRepo, getRepoApi } from "./guard";

describe("getSession", () => {
  beforeEach(() => {
    mockCookieStore = new Map();
    mockReadSession = vi.fn();
    mockRedirect = vi.fn();
  });

  it("happy: returns session data when cookie is valid", async () => {
    mockCookieStore.set("sid", { value: "abc.sig" });
    mockReadSession.mockResolvedValue({
      ok: true,
      value: { userId: "u1", businessId: "b1" },
    });

    const result = await getSession();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.userId).toBe("u1");
      expect(result.value.businessId).toBe("b1");
    }
    expect(mockReadSession).toHaveBeenCalledWith("abc.sig");
  });

  it("edge: returns error when no cookie present", async () => {
    const result = await getSession();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NO_SESSION");
    }
    expect(mockReadSession).not.toHaveBeenCalled();
  });

  it("edge: returns error when cookie value is empty", async () => {
    mockCookieStore.set("sid", { value: "" });

    const result = await getSession();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NO_SESSION");
    }
  });

  it("edge: propagates readSession error", async () => {
    mockCookieStore.set("sid", { value: "bad.sig" });
    mockReadSession.mockResolvedValue({
      ok: false,
      error: { code: "INVALID_SESSION", message: "tampered cookie" },
    });

    const result = await getSession();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_SESSION");
    }
  });
});

describe("requireSession", () => {
  beforeEach(() => {
    mockCookieStore = new Map();
    mockReadSession = vi.fn();
    mockRedirect = vi.fn();
  });

  it("happy: returns session data when authenticated", async () => {
    mockCookieStore.set("sid", { value: "abc.sig" });
    mockReadSession.mockResolvedValue({
      ok: true,
      value: { userId: "u1", businessId: "b1" },
    });

    const session = await requireSession();

    expect(session.userId).toBe("u1");
    expect(session.businessId).toBe("b1");
  });

  it("edge: redirects to /login when no session", async () => {
    await expect(requireSession()).rejects.toThrow("REDIRECT:/login");
    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });
});

describe("requireSessionApi", () => {
  beforeEach(() => {
    mockCookieStore = new Map();
    mockReadSession = vi.fn();
    mockRedirect = vi.fn();
  });

  it("happy: returns session result for API routes", async () => {
    mockCookieStore.set("sid", { value: "abc.sig" });
    mockReadSession.mockResolvedValue({
      ok: true,
      value: { userId: "u1", businessId: "b1" },
    });

    const result = await requireSessionApi();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.businessId).toBe("b1");
    }
  });

  it("edge: returns UNAUTHORIZED error instead of redirecting", async () => {
    const result = await requireSessionApi();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UNAUTHORIZED");
    }
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});

describe("getRepo", () => {
  beforeEach(() => {
    mockCookieStore = new Map();
    mockReadSession = vi.fn();
    mockRedirect = vi.fn();
  });

  it("happy: returns scoped repository from session businessId", async () => {
    mockCookieStore.set("sid", { value: "abc.sig" });
    mockReadSession.mockResolvedValue({
      ok: true,
      value: { userId: "u1", businessId: "biz-42" },
    });

    const repo = await getRepo();

    expect(repo.businessId).toBe("biz-42");
  });

  it("edge: redirects when session is missing", async () => {
    await expect(getRepo()).rejects.toThrow("REDIRECT:/login");
  });
});

describe("getRepoApi", () => {
  beforeEach(() => {
    mockCookieStore = new Map();
    mockReadSession = vi.fn();
    mockRedirect = vi.fn();
  });

  it("happy: returns scoped repository via Result for API routes", async () => {
    mockCookieStore.set("sid", { value: "abc.sig" });
    mockReadSession.mockResolvedValue({
      ok: true,
      value: { userId: "u1", businessId: "biz-99" },
    });

    const result = await getRepoApi();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.businessId).toBe("biz-99");
    }
  });

  it("edge: returns UNAUTHORIZED when no session", async () => {
    const result = await getRepoApi();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UNAUTHORIZED");
    }
  });
});
