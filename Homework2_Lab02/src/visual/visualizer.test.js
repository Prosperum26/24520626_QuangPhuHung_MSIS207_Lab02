import { describe, expect, it, vi } from 'vitest';
import { createVisualizer } from './visualizer.js';

/** requestAnimationFrame giả: test tự bấm từng khung. */
function createFakeRaf() {
  let nextId = 1;
  const pending = new Map();
  return {
    raf: (callback) => { const id = nextId; nextId += 1; pending.set(id, callback); return id; },
    caf: vi.fn((id) => { pending.delete(id); }),
    tick() {
      const callbacks = [...pending.values()];
      pending.clear();
      for (const callback of callbacks) callback(0);
    },
    get pendingCount() { return pending.size; },
  };
}

function setup({ level = 128, barCount = 8 } = {}) {
  const scheduler = createFakeRaf();
  const context = { clearRect: vi.fn(), fillRect: vi.fn(), fillStyle: '' };
  const canvas = { width: 128, height: 64, getContext: vi.fn(() => context) };
  const frequencyData = new Uint8Array(64).fill(level);
  const read = vi.fn(() => frequencyData);
  const visualizer = createVisualizer({
    canvas, read, barCount, barColor: '#123456', raf: scheduler.raf, caf: scheduler.caf,
  });
  return { visualizer, scheduler, context, canvas, read, frequencyData };
}

describe('D2 visualizer loop', () => {
  it('does nothing until started, then schedules exactly one frame', () => {
    const { visualizer, scheduler, read } = setup();
    expect(visualizer.isRunning).toBe(false);
    expect(scheduler.pendingCount).toBe(0);

    visualizer.start();
    expect(visualizer.isRunning).toBe(true);
    expect(scheduler.pendingCount).toBe(1);
    expect(read).not.toHaveBeenCalled();
  });

  it('reads the analyser once and draws every bar on each frame', () => {
    const { visualizer, scheduler, read, context } = setup({ level: 128, barCount: 8 });
    visualizer.start();
    for (let frame = 1; frame <= 5; frame += 1) {
      scheduler.tick();
      expect(read).toHaveBeenCalledTimes(frame);
      expect(context.fillRect).toHaveBeenCalledTimes(frame * 8);
    }
  });

  it('keeps asking for the next frame while running', () => {
    const { visualizer, scheduler } = setup();
    visualizer.start();
    scheduler.tick();
    expect(scheduler.pendingCount).toBe(1);
    scheduler.tick();
    expect(scheduler.pendingCount).toBe(1);
  });

  it('start() twice still runs a single loop', () => {
    const { visualizer, scheduler } = setup();
    visualizer.start();
    visualizer.start();
    expect(scheduler.pendingCount).toBe(1);
  });

  it('stop() cancels the pending frame and draws nothing more', () => {
    const { visualizer, scheduler, read } = setup();
    visualizer.start();
    scheduler.tick();
    visualizer.stop();

    expect(visualizer.isRunning).toBe(false);
    expect(scheduler.caf).toHaveBeenCalledTimes(1);
    expect(scheduler.pendingCount).toBe(0);
    scheduler.tick();
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('stop() twice is harmless and cancels only once', () => {
    const { visualizer, scheduler } = setup();
    visualizer.start();
    visualizer.stop();
    visualizer.stop();
    expect(scheduler.caf).toHaveBeenCalledTimes(1);
  });

  it('can start again after stopping', () => {
    const { visualizer, scheduler, read } = setup();
    visualizer.start();
    visualizer.stop();
    visualizer.start();
    scheduler.tick();
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('draws bars from the bottom, in the chosen colour, inside the canvas', () => {
    const { visualizer, scheduler, context, canvas } = setup({ level: 255, barCount: 8 });
    visualizer.start();
    scheduler.tick();

    expect(context.fillStyle).toBe('#123456');
    for (const [x, y, width, height] of context.fillRect.mock.calls) {
      expect(height).toBe(canvas.height);
      expect(y + height).toBe(canvas.height);
      expect(width).toBeGreaterThan(0);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x + width).toBeLessThanOrEqual(canvas.width);
    }
  });

  it('clears the canvas before drawing each frame', () => {
    const { visualizer, scheduler, context, canvas } = setup();
    visualizer.start();
    scheduler.tick();
    expect(context.clearRect).toHaveBeenCalledWith(0, 0, canvas.width, canvas.height);
    expect(context.clearRect.mock.invocationCallOrder[0])
      .toBeLessThan(context.fillRect.mock.invocationCallOrder[0]);
  });

  it('does not draw bars for silence', () => {
    const { visualizer, scheduler, context } = setup({ level: 0 });
    visualizer.start();
    scheduler.tick();
    expect(context.fillRect).not.toHaveBeenCalled();
  });

  it('clear() wipes the canvas without touching the loop', () => {
    const { visualizer, context, canvas, scheduler } = setup();
    visualizer.start();
    visualizer.clear();
    expect(context.clearRect).toHaveBeenLastCalledWith(0, 0, canvas.width, canvas.height);
    expect(visualizer.isRunning).toBe(true);
    expect(scheduler.pendingCount).toBe(1);
  });

  it('stops the loop and surfaces the error when reading fails', () => {
    const { visualizer, scheduler, read } = setup();
    read.mockImplementationOnce(() => { throw new Error('analyser gone'); });
    visualizer.start();
    expect(() => scheduler.tick()).toThrow('analyser gone');
    expect(visualizer.isRunning).toBe(false);
    expect(scheduler.pendingCount).toBe(0);
  });

  it('refuses a canvas without a 2d context', () => {
    expect(() => createVisualizer({
      canvas: { width: 1, height: 1, getContext: () => null },
      read: () => new Uint8Array(1),
      raf: () => 1,
      caf: () => {},
    })).toThrow();
  });
});
