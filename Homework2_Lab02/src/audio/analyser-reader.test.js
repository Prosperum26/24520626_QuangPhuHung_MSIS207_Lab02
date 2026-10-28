import { describe, expect, it, vi } from 'vitest';
import { FFT_SIZE, createAnalyser, createFrequencyReader } from './analyser-reader.js';

function createFakeContext() {
  const analyser = {
    fftSize: 0,
    smoothingTimeConstant: 0,
    get frequencyBinCount() { return this.fftSize / 2; },
    getByteFrequencyData: vi.fn((array) => array.fill(7)),
  };
  return { analyser, audioContext: { createAnalyser: vi.fn(() => analyser) } };
}

describe('C2 analyser', () => {
  it('uses an allowed FFT size by default', () => {
    expect([256, 512]).toContain(FFT_SIZE);
    const { analyser, audioContext } = createFakeContext();
    expect(createAnalyser(audioContext)).toBe(analyser);
    expect(analyser.fftSize).toBe(FFT_SIZE);
  });

  it.each([256, 512])('accepts fftSize %i', (size) => {
    const { analyser, audioContext } = createFakeContext();
    createAnalyser(audioContext, size);
    expect(analyser.fftSize).toBe(size);
  });

  it.each([0, 128, 1024, 300, NaN, '256'])('rejects fftSize %s', (size) => {
    const { audioContext } = createFakeContext();
    expect(() => createAnalyser(audioContext, size)).toThrow(RangeError);
    expect(audioContext.createAnalyser).not.toHaveBeenCalled();
  });

  it('smooths between frames so bars do not jitter', () => {
    const { analyser, audioContext } = createFakeContext();
    createAnalyser(audioContext);
    expect(analyser.smoothingTimeConstant).toBeGreaterThan(0);
    expect(analyser.smoothingTimeConstant).toBeLessThan(1);
  });
});

describe('C2 frequency reader', () => {
  it('has fftSize / 2 bins', () => {
    const { audioContext } = createFakeContext();
    const analyser = createAnalyser(audioContext, 512);
    expect(createFrequencyReader(analyser).binCount).toBe(256);
  });

  it('returns the very same Uint8Array on every read (no allocation per frame)', () => {
    const { audioContext } = createFakeContext();
    const reader = createFrequencyReader(createAnalyser(audioContext, 256));
    const first = reader.read();
    const second = reader.read();
    expect(first).toBeInstanceOf(Uint8Array);
    expect(second).toBe(first);
    expect(first).toHaveLength(128);
  });

  it('asks the analyser to fill that array exactly once per read', () => {
    const { analyser, audioContext } = createFakeContext();
    const reader = createFrequencyReader(createAnalyser(audioContext, 256));
    const data = reader.read();
    reader.read();
    expect(analyser.getByteFrequencyData).toHaveBeenCalledTimes(2);
    expect(analyser.getByteFrequencyData).toHaveBeenCalledWith(data);
    expect(data[0]).toBe(7);
  });
});
