// @ts-check

/**
 * Kích thước lưới theo ô: `rows` gồm cả hàng tiêu đề (row 0).
 * @typedef {{ rows: number, cols: number }} GridDims
 */

/**
 * Chỗ duy nhất quyết định phím nào đi đâu. Kẹp biên, không vòng: ở mẫu APG grid,
 * mũi tên dừng ở mép. Phím không biết thì trả lại đúng ô cũ.
 * @param {import('./grid-contract.js').CellCoord} cell
 * @param {string} key Giá trị `event.key`.
 * @param {GridDims} dims
 * @param {boolean} [ctrlKey]
 * @returns {import('./grid-contract.js').CellCoord}
 */
export function nextCell(cell, key, dims, ctrlKey = false) {
  const lastRow = dims.rows - 1;
  const lastCol = dims.cols - 1;

  /** @type {Record<string, import('./grid-contract.js').CellCoord>} */
  const moves = {
    ArrowUp: { row: Math.max(0, cell.row - 1), col: cell.col },
    ArrowDown: { row: Math.min(lastRow, cell.row + 1), col: cell.col },
    ArrowLeft: { row: cell.row, col: Math.max(0, cell.col - 1) },
    ArrowRight: { row: cell.row, col: Math.min(lastCol, cell.col + 1) },
    Home: ctrlKey ? { row: 0, col: 0 } : { row: cell.row, col: 0 },
    End: ctrlKey ? { row: lastRow, col: lastCol } : { row: cell.row, col: lastCol },
  };

  // hasOwn: tra thẳng object sẽ trả về hàm kế thừa với key như "constructor".
  return Object.hasOwn(moves, key) ? Object.freeze(moves[key]) : cell;
}

/**
 * Kéo ô đang active về trong lưới: sau khi lọc hoặc đổi trang, số dòng có thể co lại và
 * `activeCell` cũ không còn tồn tại; không kẹp thì không phần tử nào có tabindex 0.
 * @param {import('./grid-contract.js').CellCoord} cell
 * @param {GridDims} dims
 * @returns {import('./grid-contract.js').CellCoord}
 */
export function clampCell(cell, dims) {
  const row = Math.min(Math.max(cell.row, 0), dims.rows - 1);
  const col = Math.min(Math.max(cell.col, 0), dims.cols - 1);
  return row === cell.row && col === cell.col ? cell : Object.freeze({ row, col });
}

/**
 * Engine chỉ khôi phục focus theo `id`, nên id suy ra từ **vị trí** (không phải nội dung):
 * sau khi sort, focus vẫn ở cùng vị trí dù dữ liệu trong ô đã đổi.
 * @param {string} gridId
 * @param {number} row
 * @param {number} col
 */
export function cellId(gridId, row, col) {
  return `${gridId}-r${row}-c${col}`;
}

/**
 * Ngược của `cellId`; không dùng RegExp ghép từ `gridId` để id lạ không phá được pattern.
 * @param {string} gridId
 * @param {string} id
 * @returns {import('./grid-contract.js').CellCoord | null}
 */
export function parseCellId(gridId, id) {
  const prefix = `${gridId}-r`;
  if (!id.startsWith(prefix)) return null;
  const match = /^(\d+)-c(\d+)$/.exec(id.slice(prefix.length));
  return match === null ? null : Object.freeze({ row: Number(match[1]), col: Number(match[2]) });
}
