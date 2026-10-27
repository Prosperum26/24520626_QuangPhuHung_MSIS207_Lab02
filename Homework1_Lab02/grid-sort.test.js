import { describe, expect, it } from 'vitest';
import { nextSort, sortRows } from './grid-sort.js';

const ids = (rows) => rows.map((row) => row.id);

describe('sortRows (B1)', () => {
  const rows = [
    { id: 1, name: 'Cara', salary: 30 },
    { id: 2, name: 'Ann', salary: 50 },
    { id: 3, name: 'Bob', salary: 40 },
  ];

  it('sorts text ascending and descending', () => {
    expect(ids(sortRows(rows, { key: 'name', dir: 'asc' }))).toEqual([2, 3, 1]);
    expect(ids(sortRows(rows, { key: 'name', dir: 'desc' }))).toEqual([1, 3, 2]);
  });

  it('sorts numbers as numbers, not text (9 before 10)', () => {
    const numbers = [{ id: 1, n: 10 }, { id: 2, n: 9 }, { id: 3, n: 100 }];
    expect(ids(sortRows(numbers, { key: 'n', dir: 'asc' }))).toEqual([2, 1, 3]);
  });

  it('puts "item2" before "item10" (numeric collation)', () => {
    const labels = [{ id: 1, label: 'item10' }, { id: 2, label: 'item2' }];
    expect(ids(sortRows(labels, { key: 'label', dir: 'asc' }))).toEqual([2, 1]);
  });

  it('is stable: equal values keep the original order, in both directions', () => {
    const ties = [
      { id: 1, group: 'x' },
      { id: 2, group: 'x' },
      { id: 3, group: 'x' },
    ];
    expect(ids(sortRows(ties, { key: 'group', dir: 'asc' }))).toEqual([1, 2, 3]);
    expect(ids(sortRows(ties, { key: 'group', dir: 'desc' }))).toEqual([1, 2, 3]);
  });

  it('returns the original order for sort === null, as a new array', () => {
    const result = sortRows(rows, null);
    expect(ids(result)).toEqual([1, 2, 3]);
    expect(result).not.toBe(rows);
  });

  it('does not mutate the input', () => {
    const copy = structuredClone(rows);
    sortRows(rows, { key: 'name', dir: 'asc' });
    expect(rows).toEqual(copy);
  });

  it('puts null and undefined last in both directions', () => {
    const gaps = [{ id: 1, v: null }, { id: 2, v: 'b' }, { id: 3 }, { id: 4, v: 'a' }];
    expect(ids(sortRows(gaps, { key: 'v', dir: 'asc' }))).toEqual([4, 2, 1, 3]);
    expect(ids(sortRows(gaps, { key: 'v', dir: 'desc' }))).toEqual([2, 4, 1, 3]);
  });
});

describe('nextSort (B5)', () => {
  it('starts a new column at asc', () => {
    expect(nextSort(null, 'name')).toEqual({ key: 'name', dir: 'asc' });
  });

  it('goes asc, desc, then back to null', () => {
    const first = nextSort(null, 'name');
    const second = nextSort(first, 'name');
    expect(second).toEqual({ key: 'name', dir: 'desc' });
    expect(nextSort(second, 'name')).toBeNull();
  });

  it('restarts at asc when another column is clicked', () => {
    expect(nextSort({ key: 'name', dir: 'desc' }, 'salary')).toEqual({ key: 'salary', dir: 'asc' });
  });

  it('returns frozen objects', () => {
    expect(Object.isFrozen(nextSort(null, 'name'))).toBe(true);
  });
});
