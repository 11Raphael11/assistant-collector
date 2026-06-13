export type AppError = { code: string; message: string; cause?: unknown };

export type Result<T> = { ok: true; value: T } | { ok: false; error: AppError };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });

export const err = (
  code: string,
  message: string,
  cause?: unknown,
): Result<never> => ({ ok: false, error: { code, message, cause } });

export const isOk = <T>(r: Result<T>): r is { ok: true; value: T } => r.ok;
