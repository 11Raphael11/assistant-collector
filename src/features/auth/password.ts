import bcrypt from 'bcryptjs';
import { ok, err, type Result } from '@/lib/result';

const COST_FACTOR = 12;

export async function hashPassword(plain: string): Promise<Result<string>> {
  if (plain.length === 0) {
    return err('EMPTY_PASSWORD', 'Password must not be empty');
  }

  const hash = await bcrypt.hash(plain, COST_FACTOR);
  return ok(hash);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
