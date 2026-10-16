import { afterEach, describe, expect, it, vi } from 'vitest';
import { FEED_ITEMS, createDeferredFeed, createTimedFeed, parsePlan } from './feed-mock.js';

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

describe('parsePlan (B3)', () => {
  it('reads delays and fail steps', () => {
    expect(parsePlan('?plan=3000,500,fail')).toEqual([3000, 500, 'fail']);
  });

  it('tolerates spaces', () => {
    expect(parsePlan('?plan=3000, fail')).toEqual([3000, 'fail']);
  });

  it.each(['', '?', '?plan=', '?other=1', '?plan=abc', '?plan=-5'])('falls back to the default plan for %j', (search) => {
    expect(parsePlan(search)).toEqual([300]);
  });

  it('drops invalid steps but keeps the valid ones', () => {
    expect(parsePlan('?plan=100,abc,fail')).toEqual([100, 'fail']);
  });
});

describe('createTimedFeed (B3)', () => {
  afterEach(() => vi.useRealTimers());

  it('resolves after the planned delay, labelling items with the request number', async () => {
    vi.useFakeTimers();
    const fetchFeed = createTimedFeed([100]);
    const promise = fetchFeed();
    await vi.advanceTimersByTimeAsync(99);
    let settled = false;
    promise.then(() => { settled = true; });
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const items = await promise;
    expect(items).toHaveLength(FEED_ITEMS.length);
    expect(items[0].title).toContain('(request #1)');
  });

  it('rejects with a readable Error on a fail step, and repeats the last step', async () => {
    vi.useFakeTimers();
    const fetchFeed = createTimedFeed([100, 'fail']);
    const first = fetchFeed();
    await vi.advanceTimersByTimeAsync(100);
    await expect(first).resolves.toBeDefined();

    const second = fetchFeed();
    const secondResult = expect(second).rejects.toThrow('Network unreachable');
    await vi.advanceTimersByTimeAsync(300);
    await secondResult;

    const third = fetchFeed();
    const thirdResult = expect(third).rejects.toThrow('Network unreachable');
    await vi.advanceTimersByTimeAsync(300);
    await thirdResult;
  });

  it('uses the default plan when given an empty one', async () => {
    vi.useFakeTimers();
    const promise = createTimedFeed([])();
    await vi.advanceTimersByTimeAsync(300);
    await expect(promise).resolves.toBeDefined();
  });
});
