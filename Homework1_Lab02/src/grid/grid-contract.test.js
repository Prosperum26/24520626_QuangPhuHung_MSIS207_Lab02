import { describe, expect, it } from 'vitest';
import { PAGE_SIZE, SORT_CYCLE, initialGridState } from './grid-contract.js';

describe('grid contract (A1)', () => {
  it('freezes the constants', () => {
    expect(Object.isFrozen(SORT_CYCLE)).toBe(true);
    expect(Object.isFrozen(initialGridState)).toBe(true);
    expect(Object.isFrozen(initialGridState.activeCell)).toBe(true);
  });

  it('cycles asc then desc (null is added by nextSort)', () => {
    expect([...SORT_CYCLE]).toEqual(['asc', 'desc']);
  });

  it('has a positive integer page size', () => {
    expect(Number.isInteger(PAGE_SIZE)).toBe(true);
    expect(PAGE_SIZE).toBeGreaterThan(0);
  });

  it('starts unsorted, unfiltered, on page 1, at the header cell, nothing selected', () => {
    expect(initialGridState.sort).toBeNull();
    expect(initialGridState.filter).toBe('');
    expect(initialGridState.page).toBe(1);
    expect(initialGridState.activeCell).toEqual({ row: 0, col: 0 });
    expect(initialGridState.selected.size).toBe(0);
  });
});
