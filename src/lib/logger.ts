import pino, { type Logger, type DestinationStream } from "pino";

const REDACT_PATHS = [
  "phone",
  "*.phone",
  "*.*.phone",
  "nationalId",
  "*.nationalId",
  "*.*.nationalId",
  "password",
  "*.password",
  "*.*.password",
  "token",
  "*.token",
  "*.*.token",
  "secret",
  "*.secret",
  "*.*.secret",
  "apiKey",
  "*.apiKey",
  "*.*.apiKey",
  "authorization",
  "*.authorization",
  "*.*.authorization",
  "cookie",
  "*.cookie",
  "*.*.cookie",
];

const isProd = process.env.NODE_ENV === "production";

export function createLogger(destination?: DestinationStream): Logger {
  const baseOptions = {
    level: process.env.LOG_LEVEL ?? (isProd ? "info" : "debug"),
    redact: {
      paths: REDACT_PATHS,
      censor: "[REDACTED]",
    },
  };

  if (destination) {
    return pino(baseOptions, destination);
  }

  if (isProd) {
    return pino(baseOptions);
  }

  return pino({
    ...baseOptions,
    transport: {
      target: "pino-pretty",
      options: { colorize: true, translateTime: "SYS:standard" },
    },
  });
}

export const logger: Logger = createLogger();

export type LogContext = Record<string, unknown> & {
  businessId?: string;
  action?: string;
};

export function withContext(ctx: LogContext, base: Logger = logger): Logger {
  return base.child(ctx);
}
