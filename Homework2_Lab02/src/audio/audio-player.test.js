import { describe, expect, it, vi } from 'vitest';
import { createPlayer } from './audio-player.js';

/** Context giả: ghi lại mọi node đã tạo và thứ tự nối dây. */
function setup({ state = 'running' } = {}) {
  const sources = [];
  const wiring = [];

  const analyser = { name: 'analyser', connect: vi.fn((to) => wiring.push(`analyser->${to.name}`)) };
  const gain = {
    name: 'gain',
    gain: { value: 0, setTargetAtTime: vi.fn() },
    connect: vi.fn((to) => wiring.push(`gain->${to.name}`)),
  };
  const destination = { name: 'destination' };

  const audioContext = {
    state,
    currentTime: 5,
    destination,
    resume: vi.fn(async () => { audioContext.state = 'running'; }),
    createGain: vi.fn(() => gain),
    createBufferSource: vi.fn(() => {
      const source = {
        name: `source${sources.length}`,
        buffer: null,
        onended: null,
        start: vi.fn(),
        stop: vi.fn(),
        disconnect: vi.fn(),
        connect: vi.fn((to) => wiring.push(`${source.name}->${to.name}`)),
      };
      sources.push(source);
      return source;
    }),
  };

  const player = createPlayer({ audioContext, analyser });
  return { player, audioContext, analyser, gain, sources, wiring };
}

const buffer = (name) => ({ name });

describe('C3 player: node lifecycle', () => {
  it('wires source -> analyser -> gain -> destination', async () => {
    const { player, wiring } = setup();
    await player.play(buffer('A'));
    expect(wiring).toEqual(['analyser->gain', 'gain->destination', 'source0->analyser']);
  });

  it('creates a fresh source node per play, sets its buffer and starts it', async () => {
    const { player, sources } = setup();
    const a = buffer('A');
    await player.play(a);
    expect(sources).toHaveLength(1);
    expect(sources[0].buffer).toBe(a);
    expect(sources[0].start).toHaveBeenCalledTimes(1);
    expect(player.isPlaying).toBe(true);
  });

  it('stop() stops and disconnects the node exactly once and drops the reference', async () => {
    const { player, sources } = setup();
    await player.play(buffer('A'));
    player.stop();
    expect(sources[0].stop).toHaveBeenCalledTimes(1);
    expect(sources[0].disconnect).toHaveBeenCalledTimes(1);
    expect(sources[0].onended).toBeNull();
    expect(player.isPlaying).toBe(false);
  });

  it('stop() is idempotent: a second call does nothing and does not throw', async () => {
    const { player, sources } = setup();
    await player.play(buffer('A'));
    player.stop();
    expect(() => player.stop()).not.toThrow();
    expect(sources[0].stop).toHaveBeenCalledTimes(1);
    expect(sources[0].disconnect).toHaveBeenCalledTimes(1);
  });

  it('stop() with nothing playing is a no-op', () => {
    const { player } = setup();
    expect(() => player.stop()).not.toThrow();
  });

  it('cleans up by itself when the track ends, then calls onEnded once', async () => {
    const { player, sources } = setup();
    const onEnded = vi.fn();
    await player.play(buffer('A'), { onEnded });
    sources[0].onended();

    expect(sources[0].disconnect).toHaveBeenCalledTimes(1);
    expect(player.isPlaying).toBe(false);
    expect(onEnded).toHaveBeenCalledTimes(1);
  });

  it('does not call onEnded when the track is stopped on purpose', async () => {
    const { player, sources } = setup();
    const onEnded = vi.fn();
    await player.play(buffer('A'), { onEnded });
    const ended = sources[0].onended;
    player.stop();
    ended?.();
    expect(onEnded).not.toHaveBeenCalled();
  });

  it('a second play() first releases the node of the first one', async () => {
    const { player, sources } = setup();
    await player.play(buffer('A'));
    await player.play(buffer('B'));
    expect(sources).toHaveLength(2);
    expect(sources[0].stop).toHaveBeenCalledTimes(1);
    expect(sources[0].disconnect).toHaveBeenCalledTimes(1);
    expect(sources[1].disconnect).not.toHaveBeenCalled();
    expect(player.isPlaying).toBe(true);
  });

  it('ignores the late onended of a node that was already replaced', async () => {
    const { player, sources } = setup();
    const onEndedA = vi.fn();
    await player.play(buffer('A'), { onEnded: onEndedA });
    const lateEnded = sources[0].onended;
    await player.play(buffer('B'));
    lateEnded?.();
    expect(onEndedA).not.toHaveBeenCalled();
    expect(player.isPlaying).toBe(true);
  });

  it('two plays started back to back still leave exactly one live node', async () => {
    const { player, sources } = setup({ state: 'suspended' });
    await Promise.all([player.play(buffer('A')), player.play(buffer('B'))]);
    const live = sources.filter((s) => s.disconnect.mock.calls.length === 0);
    expect(live).toHaveLength(1);
  });

  it('leaves no node behind after 200 play/stop cycles', async () => {
    const { player, sources } = setup();
    for (let i = 0; i < 200; i += 1) {
      await player.play(buffer(String(i)));
      player.stop();
    }
    expect(sources).toHaveLength(200);
    expect(sources.every((s) => s.stop.mock.calls.length === 1 && s.disconnect.mock.calls.length === 1)).toBe(true);
    expect(player.isPlaying).toBe(false);
  });

  it('leaves no node behind after 200 plays that replace each other, then one stop', async () => {
    const { player, sources } = setup();
    for (let i = 0; i < 200; i += 1) await player.play(buffer(String(i)));
    player.stop();
    expect(sources.every((s) => s.stop.mock.calls.length === 1 && s.disconnect.mock.calls.length === 1)).toBe(true);
  });
});

describe('C3 player: autoplay policy', () => {
  it('resumes a suspended AudioContext before starting', async () => {
    const { player, audioContext, sources } = setup({ state: 'suspended' });
    await player.play(buffer('A'));
    expect(audioContext.resume).toHaveBeenCalledTimes(1);
    expect(sources[0].start).toHaveBeenCalledTimes(1);
  });

  it('does not call resume when already running', async () => {
    const { player, audioContext } = setup({ state: 'running' });
    await player.play(buffer('A'));
    expect(audioContext.resume).not.toHaveBeenCalled();
  });
});

describe('C4 volume', () => {
  it('starts at full volume and creates the gain node once', async () => {
    const { player, audioContext, gain } = setup();
    expect(gain.gain.value).toBe(1);
    expect(player.volume).toBe(1);
    await player.play(buffer('A'));
    await player.play(buffer('B'));
    expect(audioContext.createGain).toHaveBeenCalledTimes(1);
  });

  it('ramps to the new value with setTargetAtTime to avoid clicks', () => {
    const { player, gain, audioContext } = setup();
    player.setVolume(0.4);
    expect(gain.gain.setTargetAtTime).toHaveBeenCalledTimes(1);
    const [target, startTime, timeConstant] = gain.gain.setTargetAtTime.mock.calls[0];
    expect(target).toBe(0.4);
    expect(startTime).toBe(audioContext.currentTime);
    expect(timeConstant).toBeGreaterThan(0);
    expect(player.volume).toBe(0.4);
  });

  it('clamps to [0, 1]', () => {
    const { player, gain } = setup();
    player.setVolume(2);
    player.setVolume(-1);
    expect(gain.gain.setTargetAtTime.mock.calls.map((c) => c[0])).toEqual([1, 0]);
    expect(player.volume).toBe(0);
  });

  it.each([NaN, Infinity, undefined, '0.5'])('rejects %s', (bad) => {
    const { player, gain } = setup();
    expect(() => player.setVolume(bad)).toThrow(RangeError);
    expect(gain.gain.setTargetAtTime).not.toHaveBeenCalled();
    expect(player.volume).toBe(1);
  });

  it('keeps the volume across plays and stops', async () => {
    const { player } = setup();
    player.setVolume(0.3);
    await player.play(buffer('A'));
    player.stop();
    await player.play(buffer('B'));
    expect(player.volume).toBe(0.3);
  });
});
