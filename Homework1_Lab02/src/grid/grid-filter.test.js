import { describe, expect, it } from 'vitest';
import { filterRows } from './grid-filter.js';

const columns = [
  { header: 'Name', accessorKey: 'name' },
  { header: 'Salary', accessorKey: 'salary' },
];
const rows = [
  { id: 1, name: 'Ann Lee', salary: 50000, secret: 'hidden' },
  { id: 2, name: 'Bob', salary: 42000, secret: '' },
  { id: 3, name: 'Cara .* Dot', salary: null, secret: '' },
];
const ids = (list) => list.map((row) => row.id);

describe('filterRows (B2)', () => {
  it('matches a substring', () => {
    expect(ids(filterRows(rows, columns, 'ee'))).toEqual([1]);
  });

  it('ignores case', () => {
    expect(ids(filterRows(rows, columns, 'BOB'))).toEqual([2]);
  });

  it('matches numbers by their text', () => {
    expect(ids(filterRows(rows, columns, '420'))).toEqual([2]);
  });

  it('returns everything for an empty or blank query, as a new array', () => {
    expect(ids(filterRows(rows, columns, ''))).toEqual([1, 2, 3]);
    expect(ids(filterRows(rows, columns, '   '))).toEqual([1, 2, 3]);
    expect(filterRows(rows, columns, '')).not.toBe(rows);
  });

  it('returns an empty array when nothing matches', () => {
    expect(filterRows(rows, columns, 'zzz')).toEqual([]);
  });

  it('treats regex characters as plain text', () => {
    expect(ids(filterRows(rows, columns, '.*'))).toEqual([3]);
    expect(() => filterRows(rows, columns, '(')).not.toThrow();
  });

  it('only looks at the given columns', () => {
    expect(filterRows(rows, columns, 'hidden')).toEqual([]);
  });

  it('does not turn null into the text "null"', () => {
    expect(filterRows(rows, columns, 'null')).toEqual([]);
  });
});
