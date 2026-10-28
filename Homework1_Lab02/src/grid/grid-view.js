// @ts-check
import { filterRows } from './grid-filter.js';
import { paginate } from './grid-page.js';
import { sortRows } from './grid-sort.js';

/**
 * @template T
 * @typedef {object} VisibleRow
 * @property {T} item
 * @property {number} index Chỉ số trong `data` gốc, bền qua sort/lọc/trang (dùng cho `selected`).
 */

/**
 * Chỗ duy nhất biến (data, trạng thái) thành những dòng đang hiển thị: lọc, rồi sắp xếp
 * phần còn lại, rồi cắt trang. Hàm thuần, không đụng DOM.
 * @template {Record<string, unknown>} T
 * @param {readonly T[]} data
 * @param {readonly import('./grid-contract.js').ColumnDef<T>[]} columns
 * @param {Pick<import('./grid-contract.js').GridState, 'filter' | 'sort' | 'page'>} state
 * @returns {{ rows: VisibleRow<T>[], total: number, page: number, totalPages: number, startIndex: number }}
 */
export function deriveView(data, columns, state) {
  const indexOf = new Map(data.map((item, index) => [item, index]));
  const sorted = sortRows(filterRows(data, columns, state.filter), state.sort);
  const { rows, page, totalPages, startIndex } = paginate(sorted, state.page);

  return {
    rows: rows.map((item) => ({ item, index: /** @type {number} */ (indexOf.get(item)) })),
    total: sorted.length,
    page,
    totalPages,
    startIndex,
  };
}
