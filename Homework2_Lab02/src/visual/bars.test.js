import { describe, expect, it } from 'vitest';
import { computeBars } from './bars.js';

const data = (...values) => Uint8Array.from(values);

describe('D1 computeBars', () => {
  it('maps silence to zero-height bars', () => {
    const bars = new Uint16Array(4);
    computeBars(new Uint8Array(128), bars, 100);
    expect([...bars]).toEqual([0, 0, 0, 0]);
  });

  it('maps full level to the full height', () => {
    const bars = new Uint16Array(4);
    computeBars(new Uint8Array(128).fill(255), bars, 100);
    expect([...bars]).toEqual([100, 100, 100, 100]);
  });

  it('scales proportionally and rounds to whole pixels', () => {
    const bars = new Uint16Array(1);
    computeBars(new Uint8Array(16).fill(128), bars, 100);
    expect(bars[0]).toBe(50);
  });

  it('averages the bins that fall into one bar', () => {
    const bars = new Uint16Array(2);
    computeBars(data(0, 0, 255, 255), bars, 100);
    expect([...bars]).toEqual([0, 100]);
  });

  it('averages a mixed group', () => {
    const bars = new Uint16Array(1);
    computeBars(data(0, 255), bars, 100);
    expect(bars[0]).toBe(50);
  });

  it('covers every bin even when bins are not a multiple of the bar count', () => {
    const bars = new Uint16Array(10);
    for (let bin = 0; bin < 128; bin += 1) {
      const frequencyData = new Uint8Array(128);
      frequencyData[bin] = 255;
      computeBars(frequencyData, bars, 1000);
      expect(bars.reduce((sum, v) => sum + v, 0), `bin ${bin} was ignored`).toBeGreaterThan(0);
    }
  });

  it('stays in range when there are more bars than bins', () => {
    const bars = new Uint16Array(300);
    computeBars(new Uint8Array(128).fill(200), bars, 64);
    // 200/255 của 64 px là 50: mọi cột phải có giá trị thật (một nhóm rỗng sẽ cho NaN, bị đổi thành 0).
    expect([...bars].every((v) => v === 50)).toBe(true);
  });

  it('fills and returns the array it was given instead of allocating', () => {
    const bars = new Uint16Array(4);
    expect(computeBars(new Uint8Array(8).fill(255), bars, 10)).toBe(bars);
  });

  it('does not modify the frequency data', () => {
    const frequencyData = data(10, 20, 30, 40, 50, 60, 70, 80);
    const copy = [...frequencyData];
    computeBars(frequencyData, new Uint16Array(3), 100);
    expect([...frequencyData]).toEqual(copy);
  });

  it('handles an empty bar array', () => {
    expect(() => computeBars(new Uint8Array(8), new Uint16Array(0), 100)).not.toThrow();
  });
});
