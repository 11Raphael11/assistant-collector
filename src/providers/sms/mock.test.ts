import { describe, it, expect } from "vitest";
import { MockSmsProvider } from "./mock";
import { isOk } from "../../lib/result";

describe("MockSmsProvider", () => {
  it("happy: sends SMS and records message with providerRef", async () => {
    const provider = new MockSmsProvider();
    const result = await provider.send("09121234567", "Your code is 12345");

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;

    expect(result.value.providerRef).toMatch(/^mock-ref-\d+$/);
    expect(provider.sent).toHaveLength(1);
    expect(provider.sent[0].to).toBe("09121234567");
    expect(provider.sent[0].phoneLast4).toBe("4567");
    expect(provider.sent[0].body).toBe("Your code is 12345");
    expect(provider.sent[0].providerRef).toBe(result.value.providerRef);
    expect(provider.sent[0].sentAt).toBeInstanceOf(Date);
  });

  it("happy: deliveryStatus returns delivered for sent message", async () => {
    const provider = new MockSmsProvider();
    const sendResult = await provider.send("09121234567", "test");
    if (!isOk(sendResult)) throw new Error("send should succeed");

    const status = await provider.deliveryStatus(sendResult.value.providerRef);

    expect(isOk(status)).toBe(true);
    if (!isOk(status)) return;
    expect(status.value.status).toBe("delivered");
  });

  it("happy: deliveryStatus returns unknown for non-existent ref", async () => {
    const provider = new MockSmsProvider();
    const status = await provider.deliveryStatus("non-existent-ref");

    expect(isOk(status)).toBe(true);
    if (!isOk(status)) return;
    expect(status.value.status).toBe("unknown");
  });

  it("happy: multiple sends produce unique providerRefs", async () => {
    const provider = new MockSmsProvider();
    const r1 = await provider.send("09121111111", "msg1");
    const r2 = await provider.send("09122222222", "msg2");

    if (!isOk(r1) || !isOk(r2)) throw new Error("sends should succeed");

    expect(r1.value.providerRef).not.toBe(r2.value.providerRef);
    expect(provider.sent).toHaveLength(2);
  });

  it("edge: configured-to-fail mock returns err on send", async () => {
    const provider = new MockSmsProvider({ shouldFail: true });
    const result = await provider.send("09121234567", "Your code is 12345");

    expect(isOk(result)).toBe(false);
    if (isOk(result)) return;
    expect(result.error.code).toBe("SMS_SEND_FAILED");
    expect(provider.sent).toHaveLength(0);
  });

  it("edge: configured-to-fail mock returns err on deliveryStatus", async () => {
    const provider = new MockSmsProvider({ shouldFail: true });
    const result = await provider.deliveryStatus("some-ref");

    expect(isOk(result)).toBe(false);
    if (isOk(result)) return;
    expect(result.error.code).toBe("SMS_DELIVERY_CHECK_FAILED");
  });

  it("edge: records only last4 of phone, not full number in phoneLast4 field", async () => {
    const provider = new MockSmsProvider();
    await provider.send("09129876543", "hello");

    expect(provider.sent[0].phoneLast4).toBe("6543");
    expect(provider.sent[0].phoneLast4).toHaveLength(4);
  });
});
