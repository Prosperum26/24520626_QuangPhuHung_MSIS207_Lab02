// @ts-check

// ---------- Contract (A1) ----------

/**
 * @template T
 * @typedef {object} ColumnDef
 * @property {string} header
 * @property {keyof T} accessorKey
 * @property {boolean} [sortable]
 */

/**
 * Invariant (render): <table role="grid">, hàng tiêu đề là row 1 của aria-rowindex,
 * ô dùng ngữ nghĩa gridcell/columnheader ngầm của th/td trong grid.
 * @template T
 * @typedef {object} DataGridProps
 * @property {T[]} data
 * @property {ColumnDef<T>[]} columns
 * @property {(item: T) => void} [onRowSelect]
 * @property {string} ariaLabel
 */

/** @typedef {'asc' | 'desc'} SortDir */

/**
 * `null` là thứ tự gốc của dữ liệu.
 * @typedef {{ readonly key: string, readonly dir: SortDir } | null} SortState
 */

/**
 * `row` 0 là hàng tiêu đề, hàng dữ liệu bắt đầu từ 1.
 * @typedef {{ readonly row: number, readonly col: number }} CellCoord
 */

/**
 * Trạng thái nội bộ của grid, không nằm trong props.
 * `selected` chứa chỉ số dòng trong `data` gốc (không phải vị trí sau khi sort/lọc),
 * và không bao giờ bị sửa tại chỗ: đổi bằng cách tạo Set mới.
 * @typedef {object} GridState
 * @property {SortState} sort
 * @property {string} filter
 * @property {number} page Bắt đầu từ 1.
 * @property {CellCoord} activeCell
 * @property {ReadonlySet<number>} selected
 */

// ---------- Hằng (mỗi quyết định ở một chỗ) ----------

/** Vòng sắp xếp: asc, rồi desc, rồi quay về thứ tự gốc (`null`). */
export const SORT_CYCLE = Object.freeze(['asc', 'desc']);

/** Số dòng dữ liệu mỗi trang. */
export const PAGE_SIZE = 10;

/** @type {Readonly<GridState>} */
export const initialGridState = Object.freeze({
  sort: null,
  filter: '',
  page: 1,
  activeCell: Object.freeze({ row: 0, col: 0 }),
  selected: new Set(),
});
