import { z } from "zod";

const hex64 = z
  .string()
  .regex(/^[0-9a-fA-F]{64}$/, "must be exactly 64 hex characters (32 bytes)");

const envSchema = z.object({
  DATABASE_URL: z.string().url("must be a valid URL"),

  SESSION_SECRET: z.string().min(1, "must not be empty"),

  ENCRYPTION_KEY: hex64,
  BLIND_INDEX_KEY: hex64,

  CRON_SECRET: z.string().min(1, "must not be empty"),

  KAVENEGAR_API_KEY: z.string().optional().default(""),
  KAVENEGAR_OTP_TEMPLATE: z.string().optional().default(""),

  MELIPAYAMAK_USER: z.string().optional().default(""),
  MELIPAYAMAK_PASS: z.string().optional().default(""),

  AI_PROVIDER_API_KEY: z.string().optional().default(""),
  AI_PROVIDER_BASE_URL: z.string().optional().default(""),

  TELEGRAM_BOT_TOKEN: z.string().optional().default(""),
  TELEGRAM_CHAT_ID: z.string().optional().default(""),

  OBJECT_STORAGE_ENDPOINT: z.string().optional().default(""),
  OBJECT_STORAGE_BUCKET: z.string().optional().default(""),
  OBJECT_STORAGE_ACCESS_KEY: z.string().optional().default(""),
  OBJECT_STORAGE_SECRET_KEY: z.string().optional().default(""),
  OBJECT_STORAGE_REGION: z.string().optional().default(""),

  GLITCHTIP_DSN: z.string().optional().default(""),

  APP_TIMEZONE: z.string().min(1).optional().default("Asia/Tehran"),
});

export type Env = z.infer<typeof envSchema> & { aiEnabled: boolean };

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const details = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${details}`);
  }

  const data = result.data;
  const aiEnabled = data.AI_PROVIDER_API_KEY.length > 0;

  return Object.freeze({ ...data, aiEnabled });
}

let _env: Env | undefined;

export function getEnv(): Env {
  if (!_env) {
    _env = parseEnv(process.env);
  }
  return _env;
}

export const env: Env = new Proxy({} as Env, {
  get(_target, prop) {
    return getEnv()[prop as keyof Env];
  },
});
