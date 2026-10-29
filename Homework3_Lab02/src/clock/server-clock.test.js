import { describe, expect, it } from 'vitest';
import { createServerClock } from './server-clock.js';

function setup({ roundTrip = 100, server = 5000 } = {}) {
  const time = { mono: 0, wall: 1_000_000 };
  const clock = createServerClock({
    serverNow: async () => {
      time.mono += roundTrip;
      return server;
    },
    mono: () => time.mono,
    wall: () => time.wall,
  });
  return { time, clock };
}

describe('B1 createServerClock', () => {
  it('throws a clear error before sync()', () => {
    const { clock } = setup();
    expect(() => clock.now()).toThrow(/sync/);
    expect(() => clock.offset()).toThrow(/sync/);
  });

  it('compensates half of the round trip', async () => {
    const { clock } = setup({ roundTrip: 100, server: 5000 });
    await clock.sync();
    expect(clock.now()).toBe(5050);
  });

  it('advances with the monotonic clock', async () => {
    const { time, clock } = setup();
    await clock.sync();
    time.mono += 1000;
    expect(clock.now()).toBe(6050);
  });

  it('ignores system clock jumps after sync', async () => {
    const { time, clock } = setup();
    await clock.sync();
    time.wall += 3_600_000;
    time.mono += 10;
    expect(clock.now()).toBe(5060);
  });

  it('reports offset = server time - local wall time at sync', async () => {
    const { clock } = setup({ server: 5000, roundTrip: 0 });
    await clock.sync();
    expect(clock.offset()).toBe(5000 - 1_000_000);
  });

  it('re-anchors on a second sync()', async () => {
    const { time, clock } = setup({ roundTrip: 0, server: 5000 });
    await clock.sync();
    time.mono += 500;
    await clock.sync();
    expect(clock.now()).toBe(5000);
  });
});
