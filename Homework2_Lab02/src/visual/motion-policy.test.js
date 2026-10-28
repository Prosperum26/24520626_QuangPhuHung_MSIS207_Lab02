import { describe, expect, it, vi } from 'vitest';
import { createMotionPolicy } from './motion-policy.js';

function setup({ reducedMotion = false, hidden = false, playing = true } = {}) {
  const doc = new EventTarget();
  doc.hidden = hidden;

  const mediaListeners = new Set();
  const mediaQuery = {
    matches: reducedMotion,
    addEventListener: vi.fn((type, listener) => mediaListeners.add(listener)),
    removeEventListener: vi.fn((type, listener) => mediaListeners.delete(listener)),
  };
  const matchMedia = vi.fn(() => mediaQuery);

  const visualizer = { start: vi.fn(), stop: vi.fn() };
  const state = { playing };
  const policy = createMotionPolicy({ visualizer, isPlaying: () => state.playing, doc, matchMedia });

  return {
    policy, visualizer, doc, mediaQuery, mediaListeners, state, matchMedia,
    setHidden(value) { doc.hidden = value; doc.dispatchEvent(new Event('visibilitychange')); },
    setReduced(value) { mediaQuery.matches = value; mediaListeners.forEach((l) => l({ matches: value })); },
  };
}

const lastCall = (visualizer) => {
  const started = visualizer.start.mock.invocationCallOrder.at(-1) ?? -1;
  const stopped = visualizer.stop.mock.invocationCallOrder.at(-1) ?? -1;
  if (started === -1 && stopped === -1) return 'none';
  return started > stopped ? 'start' : 'stop';
};

describe('D3 motion policy', () => {
  it('runs the effect while playing, visible, enabled', () => {
    const t = setup();
    t.policy.sync();
    expect(lastCall(t.visualizer)).toBe('start');
  });

  it('stops when nothing is playing', () => {
    const t = setup({ playing: false });
    t.policy.sync();
    expect(lastCall(t.visualizer)).toBe('stop');
  });

  it('stops when the tab is hidden and resumes when it is visible again', () => {
    const t = setup();
    t.policy.sync();
    t.setHidden(true);
    expect(lastCall(t.visualizer)).toBe('stop');
    t.setHidden(false);
    expect(lastCall(t.visualizer)).toBe('start');
  });

  it('does not resume on a visible tab when nothing is playing', () => {
    const t = setup({ playing: false });
    t.setHidden(true);
    t.setHidden(false);
    expect(t.visualizer.start).not.toHaveBeenCalled();
  });

  it('starts with the effect OFF when the system asks for reduced motion', () => {
    const t = setup({ reducedMotion: true });
    expect(t.policy.effectEnabled).toBe(false);
    t.policy.sync();
    expect(t.visualizer.start).not.toHaveBeenCalled();
    expect(lastCall(t.visualizer)).toBe('stop');
  });

  it('starts with the effect ON otherwise', () => {
    expect(setup().policy.effectEnabled).toBe(true);
  });

  it('lets the user switch the effect on even under reduced motion', () => {
    const t = setup({ reducedMotion: true });
    t.policy.setEffectEnabled(true);
    expect(t.policy.effectEnabled).toBe(true);
    expect(lastCall(t.visualizer)).toBe('start');
  });

  it('lets the user pause and resume the effect', () => {
    const t = setup();
    t.policy.setEffectEnabled(false);
    expect(lastCall(t.visualizer)).toBe('stop');
    t.policy.setEffectEnabled(true);
    expect(lastCall(t.visualizer)).toBe('start');
  });

  it('follows the system setting when it changes during the session', () => {
    const t = setup();
    t.setReduced(true);
    expect(t.policy.effectEnabled).toBe(false);
    expect(lastCall(t.visualizer)).toBe('stop');
    t.setReduced(false);
    expect(t.policy.effectEnabled).toBe(true);
    expect(lastCall(t.visualizer)).toBe('start');
  });

  it('asks matchMedia about prefers-reduced-motion', () => {
    const t = setup();
    expect(t.matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
  });

  it('dispose() removes both listeners', () => {
    const t = setup();
    t.policy.dispose();
    expect(t.mediaListeners.size).toBe(0);
    t.visualizer.start.mockClear();
    t.visualizer.stop.mockClear();
    t.setHidden(true);
    t.setHidden(false);
    expect(t.visualizer.start).not.toHaveBeenCalled();
    expect(t.visualizer.stop).not.toHaveBeenCalled();
  });
});
