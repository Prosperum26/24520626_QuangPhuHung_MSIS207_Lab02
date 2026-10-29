import { describe, expect, it } from 'vitest';
import { createInventory } from './inventory-fsm.js';
import { createInventoryStore } from './inventory-store.js';

const make = (overrides = {}) =>
  createInventoryStore({
    initial: createInventory({ total: 2, saleWindow: { startsAt: 0, endsAt: 1_000_000 } }),
    now: () => 500,
    ...overrides,
  });

describe('D1 createInventoryStore', () => {
  it('read() returns the current snapshot with its version', async () => {
    const store = make();
    expect((await store.read()).version).toBe(0);
  });

  it('commit() applies the event with the server time and returns the new state', async () => {
    const store = make();
    const out = await store.commit(0, { type: 'RESERVE', buyerId: 'a' });
    expect(out.ok).toBe(true);
    expect(out.result).toEqual({ ok: true, id: 1 });
    expect(out.state.version).toBe(1);
    expect(out.state.reservations[0].expiresAt).toBe(500 + 120_000);
  });

  it('commit() with a stale version returns CONFLICT and leaves state unchanged', async () => {
    const store = make();
    await store.commit(0, { type: 'RESERVE', buyerId: 'a' });
    const out = await store.commit(0, { type: 'RESERVE', buyerId: 'b' });
    expect(out).toMatchObject({ ok: false, reason: 'CONFLICT' });
    expect(out.current.version).toBe(1);
    expect((await store.read()).reservations).toHaveLength(1);
    expect(store.stats().conflicts).toBe(1);
  });

  it('two concurrent commits at the same version: exactly one wins', async () => {
    const store = make();
    const [first, second] = await Promise.all([
      store.commit(0, { type: 'RESERVE', buyerId: 'a' }),
      store.commit(0, { type: 'RESERVE', buyerId: 'b' }),
    ]);
    expect([first.ok, second.ok].sort()).toEqual([false, true]);
  });

  it('a matching version with a rejected event is ok:true with result.ok:false', async () => {
    const store = make();
    const out = await store.commit(0, { type: 'CANCEL', id: 99 });
    expect(out.ok).toBe(true);
    expect(out.result).toEqual({ ok: false, reason: 'NOT_FOUND' });
    expect((await store.read()).version).toBe(0);
  });

  it('awaits the injected delay on read and commit', async () => {
    let calls = 0;
    const store = make({ delay: async () => { calls += 1; } });
    await store.read();
    await store.commit(0, { type: 'EXPIRE_DUE' });
    expect(calls).toBe(2);
  });
});
