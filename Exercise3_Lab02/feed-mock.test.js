import { describe, expect, it } from 'vitest';
import { FEED_ITEMS } from './feed-mock.js';

describe('FEED_ITEMS (B1)', () => {
  it('has unique ids', () => {
    expect(new Set(FEED_ITEMS.map((item) => item.id)).size).toBe(FEED_ITEMS.length);
  });

  it('is frozen, items included', () => {
    expect(Object.isFrozen(FEED_ITEMS)).toBe(true);
    expect(FEED_ITEMS.every((item) => Object.isFrozen(item))).toBe(true);
  });
});
