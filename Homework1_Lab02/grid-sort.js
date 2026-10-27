// @ts-check
import { SORT_CYCLE } from './grid-contract.js';

/**
 * Số so với số thì trừ; còn lại so như chuỗi với `numeric: true` để "item2" đứng trước "item10".
 * @param {unknown} a
 * @param {unknown} b
 */
function compareValues(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true });
}

/**
 * `null`/`undefined` luôn xuống cuối, kể cả khi `desc`: ô trống không nên chiếm đầu bảng.
 * Array.prototype.sort ổn định, nên dòng bằng nhau giữ thứ tự gốc.
 * @template {Record<string, unknown>} T
 * @param {readonly T[]} rows
 * @param {import('./grid-contract.js').SortState} sort
 * @returns {T[]} Mảng mới; `rows` không bị sửa.
 */
export function sortRows(rows, sort) {
  if (sort === null) return [...rows];

  const factor = sort.dir === 'asc' ? 1 : -1;
  return [...rows].sort((rowA, rowB) => {
    const a = rowA[sort.key];
    const b = rowB[sort.key];
    const aIsEmpty = a === null || a === undefined;
    const bIsEmpty = b === null || b === undefined;
    if (aIsEmpty && bIsEmpty) return 0;
    if (aIsEmpty) return 1;
    if (bIsEmpty) return -1;
    return factor * compareValues(a, b);
  });
}

/**
 * Chỗ duy nhất định nghĩa vòng sắp xếp: cột mới bắt đầu ở `asc`, hết `SORT_CYCLE` thì về `null`.
 * @param {import('./grid-contract.js').SortState} sort
 * @param {string} key
 * @returns {import('./grid-contract.js').SortState}
 */
export function nextSort(sort, key) {
  if (sort === null || sort.key !== key) {
    return Object.freeze({ key, dir: SORT_CYCLE[0] });
  }
  const next = SORT_CYCLE[SORT_CYCLE.indexOf(sort.dir) + 1];
  return next === undefined ? null : Object.freeze({ key, dir: next });
}
