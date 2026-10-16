import { describe, expect, it } from 'vitest';
import { FEED_ITEMS, createDeferredFeed } from './feed-mock.js';

describe('FEED_ITEMS (B1)', () => {
  it('has unique ids', () => {
    expect(new Set(FEED_ITEMS.map((item) => item.id)).size).toBe(FEED_ITEMS.length);
  });

  it('is frozen, items included', () => {
    expect(Object.isFrozen(FEED_ITEMS)).toBe(true);
    expect(FEED_ITEMS.every((item) => Object.isFrozen(item))).toBe(true);
  });
});

describe('createDeferredFeed (B2)', () => {
  it('does not settle on its own and records each call', () => {
    const { fetchFeed, calls } = createDeferredFeed();
    fetchFeed();
    fetchFeed();
    expect(calls).toHaveLength(2);
  });

  it('lets the test settle calls in any order', async () => {
    const { fetchFeed, calls } = createDeferredFeed();
    const order = [];
    fetchFeed().then(() => order.push(1));
    fetchFeed().then(() => order.push(2));
    calls[1].resolve([]);
    calls[0].resolve([]);
    await Promise.resolve();
    await Promise.resolve();
    expect(order).toEqual([2, 1]);
  });

  it('rejects the matching call', async () => {
    const { fetchFeed, calls } = createDeferredFeed();
    const promise = fetchFeed();
    calls[0].reject(new Error('boom'));
    await expect(promise).rejects.toThrow('boom');
  });
});
