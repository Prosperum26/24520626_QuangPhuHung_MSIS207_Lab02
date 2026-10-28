import { describe, expect, it } from 'vitest';
import { cellId, clampCell, nextCell, parseCellId } from './grid-nav.js';

const dims = { rows: 4, cols: 3 };

describe('nextCell (B4)', () => {
  it('moves one cell in the middle', () => {
    const cell = { row: 2, col: 1 };
    expect(nextCell(cell, 'ArrowUp', dims)).toEqual({ row: 1, col: 1 });
    expect(nextCell(cell, 'ArrowDown', dims)).toEqual({ row: 3, col: 1 });
    expect(nextCell(cell, 'ArrowLeft', dims)).toEqual({ row: 2, col: 0 });
    expect(nextCell(cell, 'ArrowRight', dims)).toEqual({ row: 2, col: 2 });
  });

  it('stops at each edge instead of wrapping', () => {
    expect(nextCell({ row: 0, col: 0 }, 'ArrowUp', dims)).toEqual({ row: 0, col: 0 });
    expect(nextCell({ row: 0, col: 0 }, 'ArrowLeft', dims)).toEqual({ row: 0, col: 0 });
    expect(nextCell({ row: 3, col: 2 }, 'ArrowDown', dims)).toEqual({ row: 3, col: 2 });
    expect(nextCell({ row: 3, col: 2 }, 'ArrowRight', dims)).toEqual({ row: 3, col: 2 });
  });

  it('Home and End go to the row edges', () => {
    expect(nextCell({ row: 2, col: 1 }, 'Home', dims)).toEqual({ row: 2, col: 0 });
    expect(nextCell({ row: 2, col: 1 }, 'End', dims)).toEqual({ row: 2, col: 2 });
  });

  it('Ctrl+Home and Ctrl+End go to the grid corners', () => {
    expect(nextCell({ row: 2, col: 1 }, 'Home', dims, true)).toEqual({ row: 0, col: 0 });
    expect(nextCell({ row: 2, col: 1 }, 'End', dims, true)).toEqual({ row: 3, col: 2 });
  });

  it('returns the same cell for keys it does not know, including inherited names', () => {
    const cell = { row: 1, col: 1 };
    expect(nextCell(cell, 'a', dims)).toBe(cell);
    expect(nextCell(cell, 'Enter', dims)).toBe(cell);
    expect(nextCell(cell, 'constructor', dims)).toBe(cell);
  });

  it('works on a grid with a single cell', () => {
    expect(nextCell({ row: 0, col: 0 }, 'ArrowDown', { rows: 1, cols: 1 })).toEqual({ row: 0, col: 0 });
  });
});

describe('cellId and parseCellId (B4)', () => {
  it('round-trips', () => {
    expect(parseCellId('grid', cellId('grid', 7, 3))).toEqual({ row: 7, col: 3 });
    expect(parseCellId('my-grid', cellId('my-grid', 0, 0))).toEqual({ row: 0, col: 0 });
  });

  it('returns null for ids that are not cell ids of this grid', () => {
    expect(parseCellId('grid', 'other-r1-c1')).toBeNull();
    expect(parseCellId('grid', 'grid-r1')).toBeNull();
    expect(parseCellId('grid', 'grid-rx-c1')).toBeNull();
    expect(parseCellId('grid', 'grid-r1-c1-extra')).toBeNull();
    expect(parseCellId('grid', '')).toBeNull();
  });

  it('does not treat the grid id as a pattern', () => {
    expect(parseCellId('a.c', 'abc-r1-c1')).toBeNull();
    expect(parseCellId('a.c', 'a.c-r1-c1')).toEqual({ row: 1, col: 1 });
  });
});

describe('clampCell (D5)', () => {
  it('returns the same cell when it is already inside the grid', () => {
    const cell = { row: 2, col: 1 };
    expect(clampCell(cell, dims)).toBe(cell);
  });

  it('pulls a row that no longer exists back to the last row', () => {
    expect(clampCell({ row: 10, col: 1 }, dims)).toEqual({ row: 3, col: 1 });
  });

  it('pulls a column that no longer exists back to the last column', () => {
    expect(clampCell({ row: 1, col: 9 }, dims)).toEqual({ row: 1, col: 2 });
  });

  it('collapses to the header when there are no data rows', () => {
    expect(clampCell({ row: 5, col: 0 }, { rows: 1, cols: 3 })).toEqual({ row: 0, col: 0 });
  });
});
