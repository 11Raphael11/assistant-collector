import { type SmsProvider } from "./types";
import { MockSmsProvider } from "./mock";

export function getSmsSender(): SmsProvider {
  return new MockSmsProvider();
}
