import { describe, expect, it } from 'vitest';
import { verifyInvariants } from '../inventory/inventory-fsm.js';
import { checkoutAll, simulateBuyers, simulateNaiveBuyers } from './buyers.js';

describe('D3 simulateBuyers: 200 buyers, 10 items', () => {
  it('reserves exactly 10 and never more than the stock', async () => {
    const sim = await simulateBuyers({ count: 200, total: 10, seed: 7 });
    expect(sim.reserved).toBe(10);
    expect(sim.soldOut).toBe(190);
    expect(sim.gaveUp).toBe(0);
    expect(sim.reserved + sim.soldOut + sim.gaveUp).toBe(200);
    expect(sim.state.reservations).toHaveLength(10);
    expect(sim.invariantsOk).toBe(true);
  });

  it('really races: the optimistic lock rejects stale commits', async () => {
    const sim = await simulateBuyers({ count: 200, total: 10, seed: 7 });
    expect(sim.conflicts).toBeGreaterThan(0);
  });

  it('holds for several seeds', async () => {
    for (const seed of [1, 2, 3, 99, 12345]) {
      const sim = await simulateBuyers({ count: 200, total: 10, seed });
      expect(sim.reserved).toBe(10);
      expect(sim.invariantsOk).toBe(true);
    }
  });

  it('is deterministic for the same seed', async () => {
    const a = await simulateBuyers({ seed: 5 });
    const b = await simulateBuyers({ seed: 5 });
    expect([a.reserved, a.conflicts]).toEqual([b.reserved, b.conflicts]);
  });

  it('bounded retry: with maxRetries 0 some buyers give up, still never oversell', async () => {
    const sim = await simulateBuyers({ count: 200, total: 10, seed: 7, maxRetries: 0 });
    expect(sim.gaveUp).toBeGreaterThan(0);
    expect(sim.reserved).toBeLessThanOrEqual(10);
    expect(sim.invariantsOk).toBe(true);
  });

  it('everyone pays at once: sold === total and never above', async () => {
    const sim = await simulateBuyers({ count: 200, total: 10, seed: 7 });
    const state = await checkoutAll(sim.store, sim.outcomes);
    expect(state.sold).toBe(10);
    expect(state.reservations.filter((r) => r.status === 'SOLD')).toHaveLength(10);
    expect(verifyInvariants(state)).toBe(true);
  });
});

describe('D3 race condition reproduction', () => {
  it('a naive read-wait-overwrite tells more buyers "success" than there is stock', async () => {
    const naive = await simulateNaiveBuyers({ count: 200, total: 10, seed: 7 });
    expect(naive.oversold).toBe(true);
    expect(naive.toldSuccess).toBeGreaterThan(10);
    // Lost update: hầu hết lượt giữ bị ghi đè nên state cuối không khớp số người được báo thành công.
    expect(naive.held).toBeLessThan(naive.toldSuccess);
  });
});
