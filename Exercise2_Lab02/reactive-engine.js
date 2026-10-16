// @ts-check
import { renderToDOM } from './mini-react.js';

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

/** @typedef {() => void} RenderFn */
/** @typedef {() => import('./mini-react.js').VNode} Component */

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

// ---------- Dispatcher (B1-B4) ----------

/**
 * Setter chỉ biết "việc cần làm sau khi state đổi" qua đây, không biết DOM hay container.
 * @type {RenderFn | null}
 */
let renderer = null;

/** @param {RenderFn | null} fn */
export function setRenderer(fn) {
  renderer = fn;
}

/**
 * Chỉ chấp nhận `T` hoặc `(prev) => next`. Hệ quả: state mà bản thân là một hàm
 * sẽ bị hiểu là updater (cùng giới hạn với React).
 * @template T
 * @param {T | ((prev: T) => T)} next
 * @param {T} prev
 * @returns {T}
 */
function resolveNext(next, prev) {
  return typeof next === 'function' ? /** @type {(prev: T) => T} */ (next)(prev) : /** @type {T} */ (next);
}

/**
 * Setter đóng (closure) trên `index` lúc hook được gọi, không đọc `cursor`:
 * khi setter chạy thì cursor đã ở chỗ khác, đọc nó sẽ ghi nhầm ô.
 * @template T
 * @param {T} initialValue
 * @returns {UseStateResult<T>}
 */
export function useState(initialValue) {
  const index = claimSlot(initialValue);

  /** @type {Setter<T>} */
  const setState = (next) => {
    const prev = /** @type {T} */ (stateStore[index]);
    const value = resolveNext(next, prev);
    if (Object.is(prev, value)) return;
    stateStore[index] = value;
    renderer?.();
  };

  return [/** @type {T} */ (stateStore[index]), setState];
}

// ---------- Render loop (B5) ----------

/**
 * Chỗ duy nhất gọi `resetCursor()` (project-rules: cursor reset trước mỗi lần render).
 * @param {Component} component
 * @param {Element} container
 */
function mount(component, container) {
  resetCursor();
  container.replaceChildren(renderToDOM(component()));
}

/**
 * @param {Component} component
 * @param {Element} container
 */
export function renderApp(component, container) {
  setRenderer(() => mount(component, container));
  mount(component, container);
}
