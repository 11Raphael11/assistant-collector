import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.SESSION_SECRET = "test-secret";
process.env.ENCRYPTION_KEY =
  "0000000000000000000000000000000000000000000000000000000000000000";
process.env.BLIND_INDEX_KEY =
  "1111111111111111111111111111111111111111111111111111111111111111";
process.env.CRON_SECRET = "test-cron";

const mockCreateCustomer = vi.fn();
const mockRequireSession = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock("@/features/customers", () => ({
  createCustomer: (...args: unknown[]) => mockCreateCustomer(...args),
  updateCustomer: vi.fn(),
  softDeleteCustomer: vi.fn(),
  getCustomerById: vi.fn(),
}));

vi.mock("@/features/auth", () => ({
  requireSession: () => mockRequireSession(),
  getSession: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

import { createCustomerAction } from "./actions";

const INITIAL_STATE = {};
const BUSINESS_ID = "biz-test-1";
const SESSION = { userId: "user-1", businessId: BUSINESS_ID };

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    fd.append(k, v);
  }
  return fd;
}

describe("createCustomerAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSession.mockResolvedValue(SESSION);
  });

  it("happy: valid customer data calls createCustomer and returns success", async () => {
    mockCreateCustomer.mockResolvedValue({
      ok: true,
      value: { id: "cust-1", name: "علی رضایی", phoneLast4: "6789" },
    });

    const state = await createCustomerAction(
      INITIAL_STATE,
      makeFormData({ name: "علی رضایی", phone: "09123456789" }),
    );

    expect(state.success).toBe(true);
    expect(state.error).toBeUndefined();
    expect(mockCreateCustomer).toHaveBeenCalledOnce();
    expect(mockCreateCustomer).toHaveBeenCalledWith(
      BUSINESS_ID,
      expect.objectContaining({ name: "علی رضایی", phone: "09123456789" }),
    );
    expect(mockRevalidatePath).toHaveBeenCalledOnce();
  });

  it("edge (#15): name <script>alert(1)</script> is passed as raw text — React renders it inert", async () => {
    const xssName = "<script>alert(1)</script>";
    mockCreateCustomer.mockResolvedValue({
      ok: true,
      value: { id: "cust-2", name: xssName, phoneLast4: "6789" },
    });

    const state = await createCustomerAction(
      INITIAL_STATE,
      makeFormData({ name: xssName, phone: "09123456789" }),
    );

    // The action succeeds: xssName is a valid string (22 chars, within 1–100 limit)
    expect(state.success).toBe(true);
    expect(state.error).toBeUndefined();

    // The data layer receives the raw string — no HTML escaping here.
    // XSS safety is guaranteed by React's automatic text-node escaping at render time;
    // the form never uses dangerouslySetInnerHTML.
    expect(mockCreateCustomer).toHaveBeenCalledWith(
      BUSINESS_ID,
      expect.objectContaining({ name: xssName }),
    );
  });

  it("edge: duplicate phone returns CUSTOMER_EXISTS as inline error", async () => {
    mockCreateCustomer.mockResolvedValue({
      ok: false,
      error: { code: "CUSTOMER_EXISTS", message: "این مشتری قبلاً ثبت شده" },
    });

    const state = await createCustomerAction(
      INITIAL_STATE,
      makeFormData({ name: "مریم احمدی", phone: "09123456789" }),
    );

    expect(state.success).toBeUndefined();
    expect(state.error).toBe("این مشتری قبلاً ثبت شده");
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it("edge: validation error from service is surfaced as inline error", async () => {
    mockCreateCustomer.mockResolvedValue({
      ok: false,
      error: { code: "VALIDATION", message: "phone: Invalid Iranian mobile number" },
    });

    const state = await createCustomerAction(
      INITIAL_STATE,
      makeFormData({ name: "تست", phone: "1234" }),
    );

    expect(state.success).toBeUndefined();
    expect(state.error).toBeTruthy();
    expect(mockCreateCustomer).toHaveBeenCalledOnce();
  });
});
