import { describe, expect, it } from 'vitest';
import { paginate, pageWindow } from './grid-page.js';

const items = Array.from({ length: 25 }, (_, index) => index + 1);

describe('paginate (B3)', () => {
  it('returns the first page', () => {
    const result = paginate(items, 1, 10);
    expect(result.rows).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(result).toMatchObject({ page: 1, totalPages: 3, startIndex: 0 });
  });

  it('returns a short last page', () => {
    const result = paginate(items, 3, 10);
    expect(result.rows).toEqual([21, 22, 23, 24, 25]);
    expect(result.startIndex).toBe(20);
  });

  it('clamps a page that is too high or too low', () => {
    expect(paginate(items, 99, 10).page).toBe(3);
    expect(paginate(items, 0, 10).page).toBe(1);
    expect(paginate(items, -4, 10).page).toBe(1);
  });

  it('falls back to page 1 for NaN or Infinity', () => {
    expect(paginate(items, Number.NaN, 10).page).toBe(1);
    expect(paginate(items, Number.POSITIVE_INFINITY, 10).page).toBe(1);
  });

  it('gives one empty page for zero rows', () => {
    expect(paginate([], 1, 10)).toEqual({ rows: [], page: 1, totalPages: 1, startIndex: 0 });
  });

  it('gives one page for 7 rows with size 10', () => {
    expect(paginate([1, 2, 3, 4, 5, 6, 7], 1, 10).totalPages).toBe(1);
  });

  it('gives exactly size rows on a full last page (no extra empty page)', () => {
    expect(paginate(items.slice(0, 20), 2, 10).totalPages).toBe(2);
  });

  it('defaults to PAGE_SIZE', () => {
    expect(paginate(items, 1).rows).toHaveLength(10);
  });

  it('does not mutate the input', () => {
    const copy = [...items];
    paginate(items, 2, 10);
    expect(items).toEqual(copy);
  });
});

describe('pageWindow (B3)', () => {
  it('starts at 1 near the beginning', () => {
    expect(pageWindow(1, 24)).toEqual([1, 2, 3, 4, 5]);
    expect(pageWindow(2, 24)).toEqual([1, 2, 3, 4, 5]);
  });

  it('centres on the current page in the middle', () => {
    expect(pageWindow(10, 24)).toEqual([8, 9, 10, 11, 12]);
  });

  it('ends at the last page near the end', () => {
    expect(pageWindow(24, 24)).toEqual([20, 21, 22, 23, 24]);
  });

  it('returns fewer numbers when there are fewer pages', () => {
    expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(1, 1)).toEqual([1]);
  });
});
