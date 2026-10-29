import { describe, expect, it } from 'vitest';
import { createServerClock } from '../clock/server-clock.js';
import { createFakeServer } from './fake-server.js';

describe('E4 createFakeServer', () => {
  it('returns wall time plus skew, sampled in the middle of the round trip', async () => {
    const log = [];
    let wall = 1_000;
    const server = createFakeServer({
      skewMs: 250,
      latencyMs: 100,
      wall: () => {
        log.push('sample');
        return wall;
      },
      sleep: async (ms) => {
        log.push(ms);
        wall += ms;
      },
    });
    expect(await server.serverNow()).toBe(1_000 + 50 + 250);
    expect(log).toEqual([50, 'sample', 50]);
  });

  it('lets the client clock recover the skew as its offset', async () => {
    const t = { mono: 0, wall: 5_000 };
    const server = createFakeServer({
      skewMs: 3_000,
      latencyMs: 200,
      wall: () => t.wall,
      sleep: async (ms) => {
        t.mono += ms;
        t.wall += ms;
      },
    });
    const clock = createServerClock({ serverNow: server.serverNow, mono: () => t.mono, wall: () => t.wall });
    await clock.sync();
    expect(clock.offset()).toBe(3_000);
  });
});
