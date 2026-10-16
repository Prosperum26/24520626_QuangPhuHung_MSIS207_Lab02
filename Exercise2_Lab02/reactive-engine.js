// @ts-check

// ---------- Contract (A1) ----------

/**
 * @typedef {unknown[]} StateStore
 * Mảng tuyến tính: ô i thuộc hook thứ i được gọi trong một lần render.
 */

/**
 * @template T
 * @typedef {(next: T | ((prev: T) => T)) => void} Setter
 */

/**
 * @template T
 * @typedef {[T, Setter<T>]} UseStateResult
 */

// Chữ ký các hàm sẽ cài ở commit sau (chưa có thân hàm, chỉ là type):
/**
 * @template T
 * @typedef {(initialValue: T) => UseStateResult<T>} UseState
 */
/** @typedef {() => void} RenderFn */
/** @typedef {(component: () => import('./mini-react.js').VNode, container: Element) => void} RenderApp */

// ---------- State engine (A2, A3) ----------

/**
 * Invariant: 0 <= cursor <= stateStore.length, và mỗi lần render bắt đầu với cursor === 0.
 * State sống ở ngoài hàm component vì component chạy lại từ đầu mỗi lần render.
 * @type {StateStore}
 */
export const stateStore = [];

/** Hook kế tiếp sẽ xin ô số mấy. Export `let` để test đọc được (live binding), nhưng chỉ module này ghi. */
export let cursor = 0;

/** Chỉ đưa con trỏ về đầu; không xoá `stateStore`, nếu xoá thì state mất sau mỗi render. */
export function resetCursor() {
  cursor = 0;
}

/**
 * Cấp ô cho hook đang gọi. Kiểm tra theo độ dài mảng chứ không phải `??`,
 * vì `null`/`undefined` là state hợp lệ và không được khởi tạo lại.
 * @param {unknown} initialValue
 * @returns {number} Chỉ số ô; hook giữ lại bằng closure, không đọc `cursor` về sau.
 */
export function claimSlot(initialValue) {
  const index = cursor;
  if (index >= stateStore.length) {
    stateStore.push(initialValue);
  }
  cursor += 1;
  return index;
}
