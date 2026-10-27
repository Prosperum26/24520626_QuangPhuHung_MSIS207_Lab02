// @ts-check

/**
 * Trả Set mới thay vì sửa tại chỗ: `useState` so sánh bằng `Object.is`, nên Set bị sửa
 * tại chỗ sẽ không kích hoạt render lại.
 * @param {ReadonlySet<number>} selected
 * @param {number} index Chỉ số dòng trong `data` gốc.
 * @returns {Set<number>}
 */
export function toggleSelection(selected, index) {
  const next = new Set(selected);
  if (next.has(index)) next.delete(index);
  else next.add(index);
  return next;
}
