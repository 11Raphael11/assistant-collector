import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './password';
import { isOk } from '@/lib/result';

describe('password', () => {
  it('happy: hashPassword + verifyPassword round-trip succeeds', async () => {
    const plain = 'MyS3cureP@ss!';
    const result = await hashPassword(plain);

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;

    expect(result.value).toMatch(/^\$2[ab]\$12\$/);

    const matches = await verifyPassword(plain, result.value);
    expect(matches).toBe(true);
  });

  it('edge: wrong password returns false', async () => {
    const result = await hashPassword('correct-password');
    if (!isOk(result)) throw new Error('hash failed');

    const matches = await verifyPassword('wrong-password', result.value);
    expect(matches).toBe(false);
  });

  it('edge: empty password is rejected before hashing', async () => {
    const result = await hashPassword('');

    expect(isOk(result)).toBe(false);
    if (isOk(result)) return;

    expect(result.error.code).toBe('EMPTY_PASSWORD');
  });

  it('happy: hash format is bcrypt cost 12', async () => {
    const result = await hashPassword('test-password');
    if (!isOk(result)) throw new Error('hash failed');

    const parts = result.value.split('$');
    expect(parts[1]).toBe('2a');
    expect(parts[2]).toBe('12');
  });
});
