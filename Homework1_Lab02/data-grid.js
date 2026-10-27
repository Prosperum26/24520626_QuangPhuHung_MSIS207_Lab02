// @ts-check
import { announce } from './announce.js';
import { initialGridState } from './grid-contract.js';
import { cellId, clampCell, nextCell, parseCellId } from './grid-nav.js';
import { pageWindow } from './grid-page.js';
import { toggleSelection } from './grid-selection.js';
import { nextSort } from './grid-sort.js';
import { deriveView } from './grid-view.js';
import { createElement } from './mini-react.js';
import { useState } from './reactive-engine.js';

/** Tiền tố id của mọi phần tử trong grid; engine khôi phục focus theo id nên id phải ổn định. */
const GRID_ID = 'data-grid';

const FILTER_ID = `${GRID_ID}-filter`;

/**
 * Nhãn hiển thị thật (WCAG 3.3.2), gắn bằng `for`: engine chỉ ánh xạ className, nên `htmlFor` sẽ thành attribute sai.
 * @param {string} filter
 * @param {(value: string) => void} onFilter
 */
function renderToolbar(filter, onFilter) {
  return createElement(
    'div',
    { className: 'grid-toolbar' },
    createElement('label', { for: FILTER_ID }, 'Filter rows'),
    createElement('input', {
      id: FILTER_ID,
      type: 'search',
      value: filter,
      onInput: (/** @type {Event} */ event) => onFilter(/** @type {HTMLInputElement} */ (event.target).value),
    }),
  );
}

/**
 * Nút ở biên dùng `aria-disabled` thay vì `disabled`: `disabled` làm nút mất khỏi thứ tự Tab
 * và mất focus ngay khi bấm tới trang cuối. Handler tự bỏ qua click khi đang vô hiệu.
 * @param {number} page
 * @param {number} totalPages
 * @param {(page: number) => void} onPage
 */
function renderPagination(page, totalPages, onPage) {
  /** @param {string} id @param {string} text @param {number} target @param {boolean} disabled */
  const step = (id, text, target, disabled) =>
    createElement(
      'button',
      {
        id: `${GRID_ID}-${id}`,
        type: 'button',
        'aria-disabled': disabled ? 'true' : null,
        onClick: () => {
          if (!disabled) onPage(target);
        },
      },
      text,
    );

  const numbers = pageWindow(page, totalPages).map((number) =>
    createElement(
      'button',
      {
        id: `${GRID_ID}-page-${number}`,
        type: 'button',
        'aria-label': `Page ${number}`,
        'aria-current': number === page ? 'page' : null,
        onClick: () => onPage(number),
      },
      String(number),
    ),
  );

  return createElement(
    'nav',
    { 'aria-label': 'Pagination', className: 'grid-pagination' },
    step('prev', 'Previous', page - 1, page <= 1),
    ...numbers,
    step('next', 'Next', page + 1, page >= totalPages),
  );
}

/**
 * `null`/`undefined` thành ô trống, không phải chữ "null". Luôn là chuỗi, nên giá trị từ
 * dữ liệu chỉ bao giờ thành text node (chống XSS).
 * @param {unknown} value
 */
function cellText(value) {
  return value === null || value === undefined ? '' : String(value);
}

/**
 * Roving tabindex: đúng một ô trong grid có tabindex 0 (một lần Tab vào, một lần Tab ra).
 * id theo vị trí vì engine khôi phục focus theo id; thiếu id thì focus rơi về <body> sau render.
 * @param {number} row
 * @param {number} col
 * @param {import('./grid-contract.js').CellCoord} active
 */
function focusProps(row, col, active) {
  return { id: cellId(GRID_ID, row, col), tabindex: active.row === row && active.col === col ? 0 : -1 };
}

/** @param {import('./grid-contract.js').SortDir} dir */
function ariaSortOf(dir) {
  return dir === 'asc' ? 'ascending' : 'descending';
}

/**
 * @param {string} header
 * @param {import('./grid-contract.js').SortState} sort
 */
function describeSort(header, sort) {
  return sort === null ? 'Sorting cleared' : `Sorted by ${header}, ${ariaSortOf(sort.dir)}`;
}

/**
 * Chỉ cột đang sort mang `aria-sort` (APG). Mũi tên ▲/▼ là chỉ báo thị giác không dựa vào màu,
 * ẩn khỏi trình đọc màn hình vì `aria-sort` đã nói điều đó.
 * @template {Record<string, unknown>} T
 * @param {readonly import('./grid-contract.js').ColumnDef<T>[]} columns
 * @param {import('./grid-contract.js').SortState} sort
 * @param {import('./grid-contract.js').CellCoord} active
 * @param {(column: import('./grid-contract.js').ColumnDef<T>, col: number) => void} onSort
 */
function renderHeaderRow(columns, sort, active, onSort) {
  const cells = columns.map((column, col) => {
    const dir = sort !== null && sort.key === String(column.accessorKey) ? sort.dir : null;
    // Phần tử nhận focus của ô tiêu đề: <button> nếu sortable, còn lại chính <th>.
    const focusable = focusProps(0, col, active);
    const label = column.sortable
      ? createElement(
          'button',
          { ...focusable, type: 'button', onClick: () => onSort(column, col) },
          column.header,
          dir !== null && createElement('span', { className: 'sort-indicator', 'aria-hidden': 'true' }, dir === 'asc' ? ' ▲' : ' ▼'),
        )
      : column.header;
    return createElement(
      'th',
      { scope: 'col', 'aria-sort': dir === null ? null : ariaSortOf(dir), ...(column.sortable ? {} : focusable) },
      label,
    );
  });
  return createElement('tr', { 'aria-rowindex': 1 }, ...cells);
}

/**
 * @template {Record<string, unknown>} T
 * @param {T} item
 * @param {number} rowIndex Giá trị `aria-rowindex` (hàng tiêu đề là 1).
 * @param {readonly import('./grid-contract.js').ColumnDef<T>[]} columns
 * @param {number} row Vị trí trong lưới điều hướng (hàng tiêu đề là 0, dòng đầu của trang là 1).
 * @param {import('./grid-contract.js').CellCoord} active
 * @param {(cell: import('./grid-contract.js').CellCoord) => void} onActivate
 * @param {boolean} isSelected
 */
function renderBodyRow(item, rowIndex, columns, row, active, onActivate, isSelected) {
  const cells = columns.map((column, col) =>
    createElement(
      'td',
      { ...focusProps(row, col, active), onClick: () => onActivate({ row, col }) },
      cellText(item[column.accessorKey]),
    ),
  );
  // Chuỗi 'true'/'false', không phải boolean: createElement bỏ prop `false`, nên aria-selected="false" sẽ biến mất.
  return createElement('tr', { 'aria-rowindex': rowIndex, 'aria-selected': isSelected ? 'true' : 'false' }, ...cells);
}

/** @param {number} count */
function describeSelection(count) {
  return `${count} ${count === 1 ? 'row' : 'rows'} selected`;
}

/**
 * Invariant: <table role="grid">; th/td trong grid là columnheader/gridcell theo role ngầm,
 * nên không gắn role cho tr, th, td (tránh role thừa).
 * @template {Record<string, unknown>} T
 * @param {import('./grid-contract.js').DataGridProps<T>} props
 * @returns {() => import('./mini-react.js').VNode}
 */
export function createDataGrid(props) {
  const { data, columns, ariaLabel, onRowSelect } = props;

  return function DataGrid() {
    const [state, setState] = useState(initialGridState);
    /** Mọi thay đổi state đi qua đây: một chỗ để thêm logic chung (vd. kẹp giá trị). */
    const update = (/** @type {Partial<import('./grid-contract.js').GridState>} */ patch) =>
      setState((prev) => ({ ...prev, ...patch }));

    const view = deriveView(data, columns, state);

    // Kích thước lưới điều hướng: hàng tiêu đề (0) cộng các dòng của trang hiện tại.
    const dims = { rows: view.rows.length + 1, cols: columns.length };
    const active = clampCell(state.activeCell, dims);

    const activate = (/** @type {import('./grid-contract.js').CellCoord} */ cell) => {
      if (cell.row !== active.row || cell.col !== active.col) update({ activeCell: cell });
    };

    const sortBy = (/** @type {import('./grid-contract.js').ColumnDef<T>} */ column, /** @type {number} */ col) => {
      const sort = nextSort(state.sort, String(column.accessorKey));
      update({ sort, page: 1, activeCell: { row: 0, col } });
      announce(describeSort(column.header, sort));
    };

    /**
     * Enter chọn riêng dòng này (và báo cho `onRowSelect`); Space bật/tắt dòng trong tập đã chọn.
     * `selected` giữ chỉ số trong `data` gốc nên chọn không bị lệch khi sort, lọc hay sang trang.
     */
    const selectRow = (/** @type {number} */ row, /** @type {string} */ key) => {
      const visible = view.rows[row - 1];
      if (visible === undefined) return;

      const selected = key === 'Enter' ? new Set([visible.index]) : toggleSelection(state.selected, visible.index);
      update({ selected });
      if (key === 'Enter') onRowSelect?.(visible.item);
      announce(describeSelection(selected.size));
    };

    /**
     * Một handler cho cả bảng (hub của engine tra theo _vnode): đọc toạ độ từ id của target.
     * `writeFocus` của engine khôi phục focus ở ô CŨ, nên ô đích phải tự `.focus()` sau
     * khi render (đồng bộ nên cây mới đã có).
     */
    const onKeydown = (/** @type {KeyboardEvent} */ event) => {
      // Alt/Meta + mũi tên là phím tắt của trình duyệt (vd. Alt+Trái = Back); không được nuốt.
      if (event.altKey || event.metaKey || !(event.target instanceof HTMLElement)) return;
      const cell = parseCellId(GRID_ID, event.target.id);
      if (cell === null) return;

      // Hàng 0 là tiêu đề: Enter/Space ở đó thuộc về <button> (click gốc), không phải chọn dòng.
      const isSelectKey = event.key === 'Enter' || event.key === ' ';
      if (isSelectKey && cell.row >= 1) {
        selectRow(cell.row, event.key);
        event.preventDefault(); // Space cuộn trang, Enter có thể submit form bao quanh
        return;
      }

      const next = nextCell(cell, event.key, dims, event.ctrlKey);
      if (next === cell) return; // phím không thuộc điều hướng
      event.preventDefault(); // chặn cuộn trang của mũi tên/Home/End, kể cả khi đã ở mép
      if (next.row === cell.row && next.col === cell.col) return;

      update({ activeCell: next });
      document.getElementById(cellId(GRID_ID, next.row, next.col))?.focus();
    };

    // Lọc xong về trang 1: trang hiện tại có thể không còn tồn tại khi số dòng co lại.
    const filterBy = (/** @type {string} */ filter) => {
      update({ filter, page: 1 });
      const { total } = deriveView(data, columns, { ...state, filter, page: 1 });
      announce(`Showing ${total} of ${data.length} rows`);
    };

    const goToPage = (/** @type {number} */ page) => {
      update({ page });
      announce(`Page ${page} of ${view.totalPages}`);
    };
    // Hàng tiêu đề là hàng 1, dòng dữ liệu đầu của trang bắt đầu từ startIndex + 2.
    const rows = view.rows.map(({ item, index }, position) =>
      renderBodyRow(item, view.startIndex + position + 2, columns, position + 1, active, activate, state.selected.has(index)),
    );

    const table = createElement(
      'table',
      { id: GRID_ID, role: 'grid', 'aria-label': ariaLabel, 'aria-rowcount': view.total + 1, onKeydown },
      createElement('thead', null, renderHeaderRow(columns, state.sort, active, sortBy)),
      createElement('tbody', null, ...rows),
    );
    return createElement(
      'div',
      { className: 'data-grid' },
      renderToolbar(state.filter, filterBy),
      createElement('div', { className: 'grid-scroll' }, table),
      // Ngoài <table>: trong bảng sẽ thành một hàng thừa làm lệch aria-rowcount.
      view.total === 0 && createElement('p', { className: 'grid-empty' }, 'No matching rows'),
      renderPagination(view.page, view.totalPages, goToPage),
    );
  };
}
