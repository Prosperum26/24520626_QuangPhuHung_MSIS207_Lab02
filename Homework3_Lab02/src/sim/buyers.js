// @ts-check
import { available, countHeld, createInventory, transition, verifyInvariants } from '../inventory/inventory-fsm.js';
import { createInventoryStore } from '../inventory/inventory-store.js';
import { commitWithRetry, reserveWithRetry } from '../inventory/reserve-with-retry.js';

/** Bộ sinh số giả ngẫu nhiên có seed (mulberry32) để mô phỏng lặp lại được. */
export function createRng(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** Độ trễ "mạng" bằng một vài lượt microtask: xen kẽ các người mua mà không cần timer thật. */
function microDelay(rng, maxTicks) {
  return async () => {
    const ticks = Math.floor(rng() * (maxTicks + 1));
    for (let i = 0; i < ticks; i += 1) await null;
  };
}

const SIM_NOW = 1_000;
const SIM_WINDOW = { startsAt: 0, endsAt: 1_000_000_000 };

/**
 * N người mua cùng lúc tranh `total` hàng qua khóa lạc quan.
 * @param {{ count?: number, total?: number, seed?: number, maxRetries?: number, maxDelayTicks?: number }} [options]
 */
export async function simulateBuyers({ count = 200, total = 10, seed = 1, maxRetries = 10, maxDelayTicks = 5 } = {}) {
  const store = createInventoryStore({
    initial: createInventory({ total, saleWindow: SIM_WINDOW }),
    now: () => SIM_NOW,
    delay: microDelay(createRng(seed), maxDelayTicks),
  });
  const outcomes = await Promise.all(
    Array.from({ length: count }, (_, i) => reserveWithRetry(store, `buyer-${i}`, { maxRetries })),
  );
  const state = await store.read();
  const countOf = (/** @type {string} */ status) => outcomes.filter((o) => o.status === status).length;
  return {
    count,
    total,
    reserved: countOf('RESERVED'),
    soldOut: countOf('SOLD_OUT'),
    gaveUp: countOf('GAVE_UP'),
    conflicts: store.stats().conflicts,
    invariantsOk: verifyInvariants(state),
    state,
    store,
    outcomes,
  };
}

/** Mọi lượt giữ thành công cùng đi tiếp BEGIN_CHECKOUT rồi PAY_SUCCESS, đồng thời. */
export async function checkoutAll(store, outcomes, { maxRetries = 50 } = {}) {
  const ids = outcomes.flatMap((o) => (o.status === 'RESERVED' ? [o.id] : []));
  await Promise.all(
    ids.map(async (id) => {
      await commitWithRetry(store, () => ({ event: { type: 'BEGIN_CHECKOUT', id } }), maxRetries);
      await commitWithRetry(store, () => ({ event: { type: 'PAY_SUCCESS', id } }), maxRetries);
    }),
  );
  return store.read();
}

/**
 * Bản NGÂY THƠ để chứng minh race: đọc, chờ, rồi ghi đè state không kiểm version (lost update).
 * Chỉ dùng cho test và demo, không bao giờ dùng trong engine.
 * @param {{ count?: number, total?: number, seed?: number, maxDelayTicks?: number }} [options]
 */
export async function simulateNaiveBuyers({ count = 200, total = 10, seed = 1, maxDelayTicks = 5 } = {}) {
  const delay = microDelay(createRng(seed), maxDelayTicks);
  const shared = { state: createInventory({ total, saleWindow: SIM_WINDOW }) };
  let toldSuccess = 0;
  await Promise.all(
    Array.from({ length: count }, async (_, i) => {
      const snapshot = shared.state;
      await delay();
      if (available(snapshot) <= 0) return;
      const next = transition(snapshot, { type: 'RESERVE', buyerId: `buyer-${i}`, now: SIM_NOW }).state;
      await delay();
      shared.state = next;
      toldSuccess += 1;
    }),
  );
  return { toldSuccess, held: countHeld(shared.state), oversold: toldSuccess > total };
}
