import { describe, expect, it } from 'vitest';
import { createInventory } from './inventory-fsm.js';
import { createInventoryStore } from './inventory-store.js';
import { commitWithRetry, reserveWithRetry } from './reserve-with-retry.js';

const make = (total = 1, saleWindow = { startsAt: 0, endsAt: 1_000_000 }) =>
  createInventoryStore({ initial: createInventory({ total, saleWindow }), now: () => 500 });

describe('D2 reserveWithRetry', () => {
  it('reserves on the first try when nobody interferes', async () => {
    const out = await reserveWithRetry(make(), 'a');
    expect(out).toEqual({ status: 'RESERVED', id: 1, retries: 0 });
  });

  it('returns SOLD_OUT without committing when stock is zero', async () => {
    const store = make(1);
    await reserveWithRetry(store, 'a');
    let commits = 0;
    const spy = { ...store, commit: (...args) => { commits += 1; return store.commit(...args); } };
    expect(await reserveWithRetry(spy, 'b')).toEqual({ status: 'SOLD_OUT' });
    expect(commits).toBe(0);
  });

  it('retries after a CONFLICT with a fresh read and then succeeds', async () => {
    const store = make(2);
    let injected = false;
    const interfering = {
      ...store,
      commit: async (version, event) => {
        if (!injected) {
          injected = true;
          await store.commit(version, { type: 'RESERVE', buyerId: 'rival' });
        }
        return store.commit(version, event);
      },
    };
    const out = await reserveWithRetry(interfering, 'a');
    expect(out).toEqual({ status: 'RESERVED', id: 2, retries: 1 });
  });

  it('gives up after maxRetries conflicts (bounded)', async () => {
    const store = make(100);
    let commits = 0;
    const alwaysConflict = {
      ...store,
      commit: async (version) => {
        commits += 1;
        await store.commit(version, { type: 'RESERVE', buyerId: 'rival' });
        return { ok: false, reason: 'CONFLICT', current: await store.read() };
      },
    };
    const out = await reserveWithRetry(alwaysConflict, 'a', { maxRetries: 3 });
    expect(out).toEqual({ status: 'GAVE_UP' });
    expect(commits).toBe(4);
  });

  it('maxRetries 0 means a single attempt', async () => {
    const store = make(5);
    const alwaysConflict = { ...store, commit: async () => ({ ok: false, reason: 'CONFLICT', current: await store.read() }) };
    expect(await reserveWithRetry(alwaysConflict, 'a', { maxRetries: 0 })).toEqual({ status: 'GAVE_UP' });
  });

  it('reports the FSM reason when the sale is not live', async () => {
    const store = make(1, { startsAt: 10_000, endsAt: 20_000 });
    expect(await reserveWithRetry(store, 'a')).toEqual({ status: 'REJECTED', reason: 'SALE_NOT_LIVE' });
  });
});

describe('D2 commitWithRetry', () => {
  it('returns SKIPPED when decide() says skip', async () => {
    const out = await commitWithRetry(make(), () => ({ skip: 'nothing to do' }));
    expect(out).toEqual({ status: 'SKIPPED', reason: 'nothing to do' });
  });
});
