import { describe, expect, it } from 'vitest';
import { available, countHeld, createInventory, transition, verifyInvariants } from './inventory-fsm.js';
import { CHECKOUT_MS, EXTEND_MS, HOLD_MS, MAX_EXTENSIONS } from './types.js';

const START = 1_000;
const END = 10_000_000;

const make = (total = 2) => createInventory({ total, saleWindow: { startsAt: START, endsAt: END } });

/** Chạy một chuỗi event; trả state cuối và danh sách kết quả. */
function run(state, events) {
  const results = [];
  let current = state;
  for (const event of events) {
    const out = transition(current, event);
    current = out.state;
    results.push(out.result);
  }
  return { state: current, results };
}

const reserve = (now = START, buyerId = 'a') => ({ type: 'RESERVE', buyerId, now });
const status = (state, id) => state.reservations.find((r) => r.id === id).status;

describe('C3 valid transitions', () => {
  it('RESERVE creates a RESERVED hold with expiresAt = now + HOLD_MS', () => {
    const { state, results } = run(make(), [reserve(START)]);
    expect(results[0]).toEqual({ ok: true, id: 1 });
    expect(state.reservations[0]).toMatchObject({ status: 'RESERVED', expiresAt: START + HOLD_MS, extensions: 0 });
    expect(available(state)).toBe(1);
  });

  it('RESERVED -> CHECKOUT resets expiresAt to now + CHECKOUT_MS', () => {
    const now = START + 5_000;
    const { state } = run(make(), [reserve(), { type: 'BEGIN_CHECKOUT', id: 1, now }]);
    expect(state.reservations[0]).toMatchObject({ status: 'CHECKOUT', expiresAt: now + CHECKOUT_MS });
  });

  it('CHECKOUT -> SOLD increments sold', () => {
    const { state } = run(make(), [reserve(), { type: 'BEGIN_CHECKOUT', id: 1, now: START }, { type: 'PAY_SUCCESS', id: 1, now: START }]);
    expect(status(state, 1)).toBe('SOLD');
    expect(state.sold).toBe(1);
    expect(available(state)).toBe(1);
  });

  it('CHECKOUT -> CANCELLED on PAY_FAIL gives the item back', () => {
    const { state } = run(make(1), [reserve(), { type: 'BEGIN_CHECKOUT', id: 1, now: START }, { type: 'PAY_FAIL', id: 1, now: START }]);
    expect(status(state, 1)).toBe('CANCELLED');
    expect(state.sold).toBe(0);
    expect(available(state)).toBe(1);
  });

  it.each(['RESERVED', 'CHECKOUT'])('CANCEL works from %s', (from) => {
    const events = [reserve()];
    if (from === 'CHECKOUT') events.push({ type: 'BEGIN_CHECKOUT', id: 1, now: START });
    events.push({ type: 'CANCEL', id: 1, now: START });
    expect(status(run(make(), events).state, 1)).toBe('CANCELLED');
  });

  it('EXTEND pushes expiresAt by EXTEND_MS and counts the extension', () => {
    const { state } = run(make(), [reserve(), { type: 'EXTEND', id: 1, now: START + 1 }]);
    expect(state.reservations[0]).toMatchObject({ status: 'RESERVED', expiresAt: START + HOLD_MS + EXTEND_MS, extensions: 1 });
  });
});

describe('C3 invalid transitions', () => {
  const invalid = [
    ['PAY_SUCCESS on RESERVED', [reserve(), { type: 'PAY_SUCCESS', id: 1, now: START }]],
    ['PAY_FAIL on RESERVED', [reserve(), { type: 'PAY_FAIL', id: 1, now: START }]],
    ['BEGIN_CHECKOUT twice', [reserve(), { type: 'BEGIN_CHECKOUT', id: 1, now: START }, { type: 'BEGIN_CHECKOUT', id: 1, now: START }]],
    ['EXTEND on CHECKOUT', [reserve(), { type: 'BEGIN_CHECKOUT', id: 1, now: START }, { type: 'EXTEND', id: 1, now: START }]],
    ['CANCEL on SOLD', [reserve(), { type: 'BEGIN_CHECKOUT', id: 1, now: START }, { type: 'PAY_SUCCESS', id: 1, now: START }, { type: 'CANCEL', id: 1, now: START }]],
    ['PAY_SUCCESS on CANCELLED', [reserve(), { type: 'CANCEL', id: 1, now: START }, { type: 'PAY_SUCCESS', id: 1, now: START }]],
  ];

  it.each(invalid)('rejects %s with INVALID_TRANSITION and leaves version unchanged', (_name, events) => {
    const before = run(make(), events.slice(0, -1)).state;
    const out = transition(before, events.at(-1));
    expect(out.result).toEqual({ ok: false, reason: 'INVALID_TRANSITION' });
    expect(out.state).toBe(before);
    expect(out.state.version).toBe(before.version);
  });

  it('rejects an unknown id with NOT_FOUND', () => {
    const state = make();
    const out = transition(state, { type: 'CANCEL', id: 99, now: START });
    expect(out.result).toEqual({ ok: false, reason: 'NOT_FOUND' });
    expect(out.state.version).toBe(0);
  });

  it('terminal states never change', () => {
    const base = run(make(), [reserve(), { type: 'BEGIN_CHECKOUT', id: 1, now: START }, { type: 'PAY_SUCCESS', id: 1, now: START }]).state;
    for (const type of ['BEGIN_CHECKOUT', 'PAY_SUCCESS', 'PAY_FAIL', 'EXTEND', 'CANCEL']) {
      const out = transition(base, { type, id: 1, now: START });
      expect(out.result.ok).toBe(false);
      expect(status(out.state, 1)).toBe('SOLD');
    }
  });
});

describe('C3 lazy expiry', () => {
  it('treats now === expiresAt as expired (inclusive boundary)', () => {
    const state = run(make(), [reserve()]).state;
    const edge = START + HOLD_MS;
    expect(status(transition(state, { type: 'EXPIRE_DUE', now: edge - 1 }).state, 1)).toBe('RESERVED');
    expect(status(transition(state, { type: 'EXPIRE_DUE', now: edge }).state, 1)).toBe('EXPIRED');
  });

  it('rejects payment on an overdue hold with HOLD_EXPIRED even though no timer ran', () => {
    const state = run(make(), [reserve(), { type: 'BEGIN_CHECKOUT', id: 1, now: START }]).state;
    const late = START + CHECKOUT_MS;
    const out = transition(state, { type: 'PAY_SUCCESS', id: 1, now: late });
    expect(out.result).toEqual({ ok: false, reason: 'HOLD_EXPIRED' });
    expect(status(out.state, 1)).toBe('EXPIRED');
    expect(out.state.sold).toBe(0);
  });

  it('persists the expiry even when the triggering event is rejected', () => {
    const state = run(make(1), [reserve()]).state;
    const out = transition(state, { type: 'EXTEND', id: 1, now: START + HOLD_MS });
    expect(out.result.ok).toBe(false);
    expect(status(out.state, 1)).toBe('EXPIRED');
    expect(out.state.version).toBe(state.version + 1);
    expect(available(out.state)).toBe(1);
  });

  it('frees stock for a new buyer once a hold expires', () => {
    const state = run(make(1), [reserve(START, 'a')]).state;
    expect(transition(state, reserve(START + 1, 'b')).result).toEqual({ ok: false, reason: 'SOLD_OUT' });
    const out = transition(state, reserve(START + HOLD_MS, 'b'));
    expect(out.result).toEqual({ ok: true, id: 2 });
    expect(countHeld(out.state)).toBe(1);
  });

  it('EXPIRE_DUE with nothing due returns the same state', () => {
    const state = run(make(), [reserve()]).state;
    const out = transition(state, { type: 'EXPIRE_DUE', now: START + 1 });
    expect(out.state).toBe(state);
    expect(out.result).toEqual({ ok: true });
  });
});

describe('C3 sale window, stock and extension limits', () => {
  it('rejects RESERVE before startsAt and at/after endsAt', () => {
    const state = make();
    expect(transition(state, reserve(START - 1)).result).toEqual({ ok: false, reason: 'SALE_NOT_LIVE' });
    expect(transition(state, reserve(END)).result).toEqual({ ok: false, reason: 'SALE_NOT_LIVE' });
    expect(transition(state, reserve(START)).result.ok).toBe(true);
  });

  it('rejects RESERVE when sold out', () => {
    const { state, results } = run(make(2), [reserve(START, 'a'), reserve(START, 'b'), reserve(START, 'c')]);
    expect(results.map((r) => r.ok)).toEqual([true, true, false]);
    expect(results[2]).toEqual({ ok: false, reason: 'SOLD_OUT' });
    expect(state.reservations).toHaveLength(2);
  });

  it(`allows ${MAX_EXTENSIONS} extensions then rejects with EXTENSION_LIMIT`, () => {
    const events = [reserve()];
    for (let i = 0; i < MAX_EXTENSIONS; i++) events.push({ type: 'EXTEND', id: 1, now: START + i });
    const state = run(make(), events).state;
    const out = transition(state, { type: 'EXTEND', id: 1, now: START + 10 });
    expect(out.result).toEqual({ ok: false, reason: 'EXTENSION_LIMIT' });
    expect(out.state.reservations[0].extensions).toBe(MAX_EXTENSIONS);
  });
});

describe('C3 immutability and invariants', () => {
  it('returns frozen state and never mutates the previous one', () => {
    const before = make();
    const snapshot = JSON.stringify(before);
    const out = transition(before, reserve());
    expect(JSON.stringify(before)).toBe(snapshot);
    expect(Object.isFrozen(out.state)).toBe(true);
    expect(Object.isFrozen(out.state.reservations)).toBe(true);
    expect(Object.isFrozen(out.state.reservations[0])).toBe(true);
    expect(Object.isFrozen(out.state.saleWindow)).toBe(true);
  });

  it('bumps version once per accepted event and never lowers it', () => {
    const events = [reserve(), { type: 'BEGIN_CHECKOUT', id: 1, now: START }, { type: 'PAY_SUCCESS', id: 1, now: START }];
    let state = make();
    const versions = [state.version];
    for (const event of events) {
      state = transition(state, event).state;
      versions.push(state.version);
    }
    expect(versions).toEqual([0, 1, 2, 3]);
  });

  it('verifyInvariants holds across a mixed sequence and detects corruption', () => {
    const { state } = run(make(3), [
      reserve(START, 'a'), reserve(START, 'b'), reserve(START, 'c'),
      { type: 'BEGIN_CHECKOUT', id: 1, now: START }, { type: 'PAY_SUCCESS', id: 1, now: START },
      { type: 'CANCEL', id: 2, now: START },
      { type: 'EXPIRE_DUE', now: START + HOLD_MS },
    ]);
    expect(verifyInvariants(state)).toBe(true);
    expect(verifyInvariants({ ...state, sold: state.total + 1 })).toBe(false);
    expect(verifyInvariants({ ...state, sold: state.sold + 1 })).toBe(false);
    expect(verifyInvariants({ ...state, reservations: [state.reservations[0], state.reservations[0]] })).toBe(false);
  });
});
