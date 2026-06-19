import { type Result, ok, err } from "../../lib/result";
import { logger } from "../../lib/logger";
import {
  type SmsProvider,
  type SmsSendResult,
  type SmsDeliveryResult,
} from "./types";

export interface MockSentMessage {
  to: string;
  phoneLast4: string;
  body: string;
  providerRef: string;
  sentAt: Date;
}

export class MockSmsProvider implements SmsProvider {
  readonly sent: MockSentMessage[] = [];
  private shouldFail: boolean;
  private refCounter = 0;

  constructor(options?: { shouldFail?: boolean }) {
    this.shouldFail = options?.shouldFail ?? false;
  }

  async send(to: string, body: string): Promise<Result<SmsSendResult>> {
    const phoneLast4 = to.slice(-4);

    if (this.shouldFail) {
      logger.warn({ phoneLast4, action: "sms_send_mock_fail" }, "Mock SMS send configured to fail");
      return err("SMS_SEND_FAILED", "Mock provider configured to fail");
    }

    this.refCounter += 1;
    const providerRef = `mock-ref-${this.refCounter}`;

    this.sent.push({
      to,
      phoneLast4,
      body,
      providerRef,
      sentAt: new Date(),
    });

    logger.info({ phoneLast4, providerRef, action: "sms_send_mock" }, "Mock SMS sent");

    return ok({ providerRef });
  }

  async deliveryStatus(ref: string): Promise<Result<SmsDeliveryResult>> {
    if (this.shouldFail) {
      return err("SMS_DELIVERY_CHECK_FAILED", "Mock provider configured to fail");
    }

    const found = this.sent.find((m) => m.providerRef === ref);
    if (!found) {
      return ok({ status: "unknown" as const });
    }

    return ok({ status: "delivered" as const });
  }
}
