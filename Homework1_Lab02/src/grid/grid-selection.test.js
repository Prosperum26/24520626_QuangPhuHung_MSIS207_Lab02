import { describe, expect, it } from 'vitest';
import { toggleSelection } from './grid-selection.js';

describe('toggleSelection (B5)', () => {
  it('adds an index that is not selected', () => {
    expect([...toggleSelection(new Set(), 4)]).toEqual([4]);
  });

  it('removes an index that is selected', () => {
    expect(toggleSelection(new Set([4, 7]), 4).has(4)).toBe(false);
  });

  it('toggling twice returns to the starting contents', () => {
    const start = new Set([1]);
    expect([...toggleSelection(toggleSelection(start, 2), 2)]).toEqual([1]);
  });

  it('never mutates the input and always returns a new Set', () => {
    const start = new Set([1]);
    const result = toggleSelection(start, 2);
    expect([...start]).toEqual([1]);
    expect(result).not.toBe(start);
  });
});
