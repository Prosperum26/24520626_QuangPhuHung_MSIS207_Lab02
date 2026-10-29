import { describe, expect, it } from 'vitest';
import { formatRemaining, splitRemaining, toIsoDuration } from './format-time.js';

describe('E1 format-time', () => {
  it('formats mm:ss.mmm', () => {
    expect(formatRemaining(90_500)).toBe('01:30.500');
    expect(formatRemaining(61_001)).toBe('01:01.001');
  });

  it('formats zero and clamps negatives', () => {
    expect(formatRemaining(0)).toBe('00:00.000');
    expect(formatRemaining(-250)).toBe('00:00.000');
  });

  it('does not wrap minutes past 99', () => {
    expect(formatRemaining(100 * 60_000)).toBe('100:00.000');
  });

  it('floors fractional milliseconds', () => {
    expect(formatRemaining(999.9)).toBe('00:00.999');
  });

  it('splits the clock from the milliseconds', () => {
    expect(splitRemaining(5_042)).toEqual({ clock: '00:05', millis: '042' });
  });

  it('builds a valid ISO 8601 duration for <time datetime>', () => {
    expect(toIsoDuration(90_500)).toBe('PT1M30.500S');
    expect(toIsoDuration(0)).toBe('PT0M0.000S');
  });
});
