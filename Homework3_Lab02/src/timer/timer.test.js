import { describe, expect, it } from 'vitest';
import { createCountdown } from './countdown.js';
import { createAntiDriftTimer } from './anti-drift-timer.js';

/** now/raf giả: advance(dt) tiến thời gian rồi chạy các callback đang chờ (một "frame"). */
function makeEnv(start = 1000) {
  let t = start;
  let nextId = 1;
  const queue = new Map();
  return {
    deps: {
      now: () => t,
      raf: (cb) => {
        const id = nextId++;
        queue.set(id, cb);
        return id;
      },
      caf: (id) => queue.delete(id),
    },
    time: () => t,
    pending: () => queue.size,
    advance(dt) {
      t += dt;
      const callbacks = [...queue.values()];
      queue.clear();
      callbacks.forEach((cb) => cb());
    },
  };
}

function mulberry32(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

describe('B3 createCountdown', () => {
  it('reports target - now on the first frame', () => {
    const env = makeEnv(1000);
    const ticks = [];
    createCountdown(6000, (r) => ticks.push(r), env.deps);
    env.advance(16);
    expect(ticks).toEqual([4984]);
  });

  it('does not drift when frames arrive late at random', () => {
    const env = makeEnv(0);
    const random = mulberry32(42);
    const target = 60_000;
    const ticks = [];
    createCountdown(target, (r) => ticks.push({ r, at: env.time() }), env.deps);
    while (env.pending() > 0) env.advance(8 + Math.floor(random() * 120));
    for (const { r, at } of ticks) expect(r).toBe(Math.max(0, target - at));
    expect(ticks.at(-1).r).toBe(0);
  });

  it('calls onTick(0) exactly once and stops scheduling', () => {
    const env = makeEnv(0);
    const ticks = [];
    createCountdown(100, (r) => ticks.push(r), env.deps);
    env.advance(50);
    env.advance(60);
    env.advance(60);
    expect(ticks.filter((r) => r === 0)).toHaveLength(1);
    expect(env.pending()).toBe(0);
  });

  it('calls onTick(0) once when the target is already in the past', () => {
    const env = makeEnv(1000);
    const ticks = [];
    createCountdown(500, (r) => ticks.push(r), env.deps);
    env.advance(16);
    env.advance(16);
    expect(ticks).toEqual([0]);
  });

  it('never reports a negative remaining time', () => {
    const env = makeEnv(0);
    const ticks = [];
    createCountdown(100, (r) => ticks.push(r), env.deps);
    env.advance(10_000);
    expect(ticks.every((r) => r >= 0)).toBe(true);
  });

  it('is correct on the first frame after a long jump (hidden tab)', () => {
    const env = makeEnv(0);
    const ticks = [];
    createCountdown(60_000, (r) => ticks.push(r), env.deps);
    env.advance(30_000);
    expect(ticks).toEqual([30_000]);
  });

  it('stops all ticks after cancel, including the final one', () => {
    const env = makeEnv(0);
    const ticks = [];
    const cancel = createCountdown(100, (r) => ticks.push(r), env.deps);
    env.advance(10);
    cancel();
    env.advance(500);
    expect(ticks).toEqual([90]);
    expect(env.pending()).toBe(0);
  });

  it('can be cancelled before the first frame and cancelled twice', () => {
    const env = makeEnv(0);
    const ticks = [];
    const cancel = createCountdown(100, (r) => ticks.push(r), env.deps);
    cancel();
    expect(() => cancel()).not.toThrow();
    env.advance(500);
    expect(ticks).toEqual([]);
  });

  it('can be cancelled from inside onTick', () => {
    const env = makeEnv(0);
    const ticks = [];
    let cancel = () => {};
    cancel = createCountdown(1000, (r) => {
      ticks.push(r);
      cancel();
    }, env.deps);
    env.advance(10);
    env.advance(10);
    expect(ticks).toEqual([990]);
    expect(env.pending()).toBe(0);
  });
});

describe('B3 createAntiDriftTimer', () => {
  it('fixes the target when created, not when frames run', () => {
    const env = makeEnv(1000);
    const ticks = [];
    createAntiDriftTimer(5000, (r) => ticks.push(r), env.deps);
    env.advance(2000);
    env.advance(3000);
    expect(ticks).toEqual([3000, 0]);
  });

  it('works with a non-positive duration', () => {
    const env = makeEnv(1000);
    const ticks = [];
    createAntiDriftTimer(0, (r) => ticks.push(r), env.deps);
    env.advance(16);
    expect(ticks).toEqual([0]);
  });
});
