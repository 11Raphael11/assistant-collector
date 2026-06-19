import { type Result } from "../../lib/result";

export interface SmsSendResult {
  providerRef: string;
}

export interface SmsDeliveryResult {
  status: "delivered" | "pending" | "failed" | "unknown";
}

export interface SmsProvider {
  send(to: string, body: string): Promise<Result<SmsSendResult>>;
  deliveryStatus(ref: string): Promise<Result<SmsDeliveryResult>>;
}
