import { z } from "zod";
import { toLatinDigits } from "./digits";
import { type Result, ok, err } from "./result";

export const zPersianDigits = z.preprocess(
  (val) => (typeof val === "string" ? toLatinDigits(val) : val),
  z.string(),
);

export const zRialAmount = z.preprocess(
  (val) => {
    if (typeof val === "string") {
      const latin = toLatinDigits(val).trim();
      if (latin === "") return val;
      const n = Number(latin);
      return Number.isFinite(n) ? n : val;
    }
    return val;
  },
  z.number().int().positive(),
);

function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

export function parseOrError<T>(
  schema: z.ZodType<T>,
  input: unknown,
): Result<T> {
  const result = schema.safeParse(input);
  if (result.success) return ok(result.data);
  return err("VALIDATION", formatZodError(result.error));
}
