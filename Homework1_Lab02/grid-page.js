// @ts-check
import { PAGE_SIZE } from './grid-contract.js';

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Kẹp `page` vào [1, totalPages] ở một chỗ, để lọc làm co số trang không để lại trang không tồn tại.
 * `startIndex` là số dòng đứng trước trang này, dùng để tính `aria-rowindex`.
 * @template T
 * @param {readonly T[]} rows
 * @param {number} page
 * @param {number} [size]
 * @returns {{ rows: T[], page: number, totalPages: number, startIndex: number }}
 */
export function paginate(rows, page, size = PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(rows.length / size));
  const safePage = Number.isFinite(page) ? clamp(Math.trunc(page), 1, totalPages) : 1;
  const startIndex = (safePage - 1) * size;
  return { rows: rows.slice(startIndex, startIndex + size), page: safePage, totalPages, startIndex };
}

/**
 * Danh sách số trang quanh trang hiện tại, tối đa `max` số, luôn nằm trong [1, totalPages].
 * @param {number} page
 * @param {number} totalPages
 * @param {number} [max]
 * @returns {number[]}
 */
export function pageWindow(page, totalPages, max = 5) {
  const length = Math.min(max, totalPages);
  const start = clamp(page - Math.floor(max / 2), 1, totalPages - length + 1);
  return Array.from({ length }, (_, offset) => start + offset);
}
