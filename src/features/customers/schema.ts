import { z } from "zod";
import { toLatinDigits } from "../../lib/digits";
import { normalizePhone } from "../../lib/phone";
import { isOk } from "../../lib/result";

function validateNationalId(digits: string): boolean {
  if (!/^\d{10}$/.test(digits)) return false;

  if (/^(\d)\1{9}$/.test(digits)) return false;

  const weights = [10, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number(digits[i]) * weights[i];
  }
  const remainder = sum % 11;
  const checkDigit = Number(digits[9]);
  return remainder < 2 ? checkDigit === remainder : checkDigit === 11 - remainder;
}

export const nationalIdSchema = z
  .string()
  .transform((val) => toLatinDigits(val).trim())
  .refine((val) => validateNationalId(val), {
    message: "Invalid Iranian national ID (check digit failed)",
  });

const phoneSchema = z.string().transform((val, ctx) => {
  const result = normalizePhone(val);
  if (!isOk(result)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Invalid Iranian mobile number",
    });
    return z.NEVER;
  }
  return result.value;
});

const nameSchema = z
  .string()
  .min(1, "Name is required")
  .max(100, "Name must be at most 100 characters");

export const createCustomerSchema = z.object({
  name: nameSchema,
  phone: phoneSchema,
  nationalId: nationalIdSchema.optional(),
});

export const updateCustomerSchema = z.object({
  name: nameSchema.optional(),
  phone: phoneSchema.optional(),
  nationalId: nationalIdSchema.optional(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
