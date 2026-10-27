// @ts-check

/**
 * Khớp chuỗi con, không phân biệt hoa thường, trên mọi cột của `columns`.
 * Dùng `includes` (không dựng RegExp) nên ký tự như `.*` chỉ là chữ thường.
 * `null`/`undefined` thành chuỗi rỗng, không phải chữ "null".
 * @template {Record<string, unknown>} T
 * @param {readonly T[]} rows
 * @param {readonly import('./grid-contract.js').ColumnDef<T>[]} columns
 * @param {string} query
 * @returns {T[]}
 */
export function filterRows(rows, columns, query) {
  const needle = query.trim().toLowerCase();
  if (needle === '') return [...rows];

  return rows.filter((row) =>
    columns.some((column) => String(row[column.accessorKey] ?? '').toLowerCase().includes(needle)),
  );
}
