import { describe, expect, it } from 'vitest';
import { CHECKOUT_MS, EXTEND_MS, HOLD_MS, MAX_EXTENSIONS } from './types.js';

describe('A1 inventory constants', () => {
  it('are positive integers', () => {
    for (const value of [HOLD_MS, CHECKOUT_MS, EXTEND_MS, MAX_EXTENSIONS]) {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThan(0);
    }
  });

  it('keeps the documented defaults', () => {
    expect([HOLD_MS, CHECKOUT_MS, EXTEND_MS, MAX_EXTENSIONS]).toEqual([120_000, 60_000, 60_000, 2]);
  });
});
