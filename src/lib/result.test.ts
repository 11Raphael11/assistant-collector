import { describe, it, expect, assertType } from 'vitest';
import { ok, err, isOk, type Result } from './result';

describe('Result<T>', () => {
  it('happy: ok(value) wraps a value and isOk returns true', () => {
    const result = ok(5);

    expect(result.ok).toBe(true);
    expect(isOk(result)).toBe(true);

    if (isOk(result)) {
      expect(result.value).toBe(5);
    }
  });

  it('happy: ok works with complex types', () => {
    const data = { name: 'test', items: [1, 2, 3] };
    const result = ok(data);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toEqual(data);
    }
  });

  it('edge: err() creates a failure result with code and message', () => {
    const result = err('NOT_FOUND', 'item not found');

    expect(result.ok).toBe(false);
    expect(isOk(result)).toBe(false);

    if (!isOk(result)) {
      expect(result.error.code).toBe('NOT_FOUND');
      expect(result.error.message).toBe('item not found');
      expect(result.error.cause).toBeUndefined();
    }
  });

  it('edge: err() preserves the cause when provided', () => {
    const original = new Error('db timeout');
    const result = err('DB_ERROR', 'query failed', original);

    if (!isOk(result)) {
      expect(result.error.cause).toBe(original);
    }
  });

  it('edge: a function returning Result<T> narrows correctly on both branches', () => {
    function divide(a: number, b: number): Result<number> {
      if (b === 0) return err('DIV_ZERO', 'division by zero');
      return ok(a / b);
    }

    const success = divide(10, 2);
    if (isOk(success)) {
      expect(success.value).toBe(5);
      assertType<number>(success.value);
    }

    const failure = divide(10, 0);
    if (!isOk(failure)) {
      expect(failure.error.code).toBe('DIV_ZERO');
      assertType<string>(failure.error.message);
    }
  });

  it('edge: type narrowing prevents accessing value on error branch (compile-time safety)', () => {
    const result: Result<string> = err('FAIL', 'oops');

    if (result.ok) {
      assertType<string>(result.value);
    } else {
      assertType<string>(result.error.code);
      // @ts-expect-error — value does not exist on the error branch
      result.value;
    }
  });
});
