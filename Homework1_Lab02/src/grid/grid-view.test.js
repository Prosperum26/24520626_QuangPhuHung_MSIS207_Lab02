import { describe, expect, it } from 'vitest';
import { EMPLOYEES } from '../data/employees.js';
import { deriveView } from './grid-view.js';

const columns = [
  { header: 'Name', accessorKey: 'name', sortable: true },
  { header: 'Department', accessorKey: 'department' },
  { header: 'Salary', accessorKey: 'salary', sortable: true },
];
const base = { filter: '', sort: null, page: 1 };

describe('deriveView (D0)', () => {
  it('shows the first 10 rows of the unfiltered data with total and page count', () => {
    const view = deriveView(EMPLOYEES, columns, base);
    expect(view.rows).toHaveLength(10);
    expect(view).toMatchObject({ total: 240, page: 1, totalPages: 24, startIndex: 0 });
    expect(view.rows.map((row) => row.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('keeps the original index after sorting, so selection survives a re-sort', () => {
    const view = deriveView(EMPLOYEES, columns, { ...base, sort: { key: 'salary', dir: 'desc' } });
    for (const { item, index } of view.rows) expect(EMPLOYEES[index]).toBe(item);
    const salaries = view.rows.map((row) => row.item.salary);
    expect(salaries).toEqual([...salaries].sort((a, b) => b - a));
  });

  it('sorts the whole filtered set before paging, not just the visible page', () => {
    const page1 = deriveView(EMPLOYEES, columns, { ...base, sort: { key: 'salary', dir: 'asc' } });
    const lowest = Math.min(...EMPLOYEES.map((e) => e.salary));
    expect(page1.rows[0].item.salary).toBe(lowest);
  });

  it('filters first: total reflects the filtered count and pages shrink', () => {
    const view = deriveView(EMPLOYEES, columns, { ...base, filter: 'engineering' });
    const expected = EMPLOYEES.filter((e) => e.department === 'Engineering').length;
    expect(view.total).toBe(expected);
    expect(view.totalPages).toBe(Math.ceil(expected / 10));
    expect(view.rows.every((row) => row.item.department === 'Engineering')).toBe(true);
  });

  it('clamps a page that no longer exists after filtering', () => {
    const view = deriveView(EMPLOYEES, columns, { ...base, filter: 'engineering', page: 24 });
    expect(view.page).toBe(view.totalPages);
  });

  it('gives an empty page for no matches', () => {
    expect(deriveView(EMPLOYEES, columns, { ...base, filter: 'zzzz' })).toMatchObject({
      rows: [],
      total: 0,
      page: 1,
      totalPages: 1,
    });
  });

  it('computes startIndex for later pages', () => {
    expect(deriveView(EMPLOYEES, columns, { ...base, page: 3 }).startIndex).toBe(20);
  });
});
