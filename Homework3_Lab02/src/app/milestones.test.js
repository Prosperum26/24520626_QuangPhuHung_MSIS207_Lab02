import { describe, expect, it } from 'vitest';
import { HOLD_MILESTONES, createMilestoneTracker } from './milestones.js';

const make = (initial = 120_000) => {
  const tracker = createMilestoneTracker(HOLD_MILESTONES);
  tracker.arm(initial);
  return tracker;
};

describe('E3 milestone tracker', () => {
  it('announces nothing while above every milestone', () => {
    expect(make().check(100_000)).toBeNull();
  });

  it('announces each milestone exactly once', () => {
    const tracker = make();
    expect(tracker.check(59_000)?.id).toBe('m60');
    expect(tracker.check(58_000)).toBeNull();
    expect(tracker.check(9_000)?.id).toBe('m10');
    expect(tracker.check(8_000)).toBeNull();
    expect(tracker.check(0)?.id).toBe('m0');
    expect(tracker.check(0)).toBeNull();
  });

  it('uses status for the 1-minute mark and alert for 10 seconds and expiry', () => {
    const byId = Object.fromEntries(HOLD_MILESTONES.map((m) => [m.id, m.level]));
    expect(byId).toEqual({ m60: 'status', m10: 'alert', m0: 'alert' });
  });

  it('reports only the most urgent milestone after a long jump (hidden tab)', () => {
    expect(make().check(5_000)?.id).toBe('m10');
    expect(make().check(0)?.id).toBe('m0');
  });

  it('stays silent for milestones already behind the starting point', () => {
    const tracker = make(60_000);
    expect(tracker.check(59_999)).toBeNull();
    expect(tracker.check(9_000)?.id).toBe('m10');
  });

  it('re-arms after an extension so the warnings can fire again', () => {
    const tracker = make();
    tracker.check(8_000);
    tracker.arm(68_000);
    expect(tracker.check(59_000)?.id).toBe('m60');
    expect(tracker.check(9_000)?.id).toBe('m10');
  });
});
