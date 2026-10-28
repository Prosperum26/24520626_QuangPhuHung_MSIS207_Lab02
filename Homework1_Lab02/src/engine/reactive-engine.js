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
 * @typedef {object} FocusSnapshot
 * @property {string} id
 * @property {{ start: number, end: number, direction: 'forward' | 'backward' | 'none' } | null} selection
 * Chỉ có khi phần tử focus là <input> hỗ trợ selection (text, search...).
 */

/**
 * Pha đọc: id (và caret nếu là ô nhập) của phần tử đang focus nếu nó nằm trong container.
 * `replaceChildren` huỷ phần tử đó, nên phải ghi nhớ trước khi thay cây (WCAG 2.4.3).
 * Ô nhập mới tạo có caret ở đầu; không khôi phục thì gõ tiếp sẽ chèn ngược chữ.
 * @param {Element} container
 * @returns {FocusSnapshot | null}
 */
function readFocus(container) {
  const active = document.activeElement;
  const isInside = active instanceof HTMLElement && active.id !== '' && container.contains(active);
  if (!isInside) return null;

  // selectionStart là null với input không hỗ trợ selection (number, email...).
  const hasSelection = active instanceof HTMLInputElement && active.selectionStart !== null && active.selectionEnd !== null;
  return {
    id: active.id,
    selection: hasSelection
      ? { start: active.selectionStart ?? 0, end: active.selectionEnd ?? 0, direction: active.selectionDirection ?? 'none' }
      : null,
  };
}

/**
 * Pha ghi: trả focus cho phần tử cùng id trong cây mới. Duyệt thay vì ghép id vào
 * selector để id lạ không thể phá selector. Nếu phần tử không còn (vd. task vừa
 * bị lọc mất) thì không focus gì; xem mục rủi ro trong TASK_DECOMPOSITION.
 * @param {Element} container
 * @param {FocusSnapshot | null} snapshot
 */
function writeFocus(container, snapshot) {
  if (snapshot === null) return;
  const target = [...container.querySelectorAll('[id]')].find((element) => element.id === snapshot.id);
  if (!(target instanceof HTMLElement)) return;

  target.focus();
  if (snapshot.selection !== null && target instanceof HTMLInputElement) {
    target.setSelectionRange(snapshot.selection.start, snapshot.selection.end, snapshot.selection.direction);
  }
}

/**
 * Chỗ duy nhất gọi `resetCursor()` (project-rules: cursor reset trước mỗi lần render).
 * @param {Component} component
 * @param {Element} container
 */
function mount(component, container) {
  const focus = readFocus(container);
  resetCursor();
  container.replaceChildren(renderToDOM(component()));
  writeFocus(container, focus);
}

/**
 * @param {Component} component
 * @param {Element} container
 */
export function renderApp(component, container) {
  setRenderer(() => mount(component, container));
  mount(component, container);
}

// ---------- Event delegation hub (C3, C4) ----------

/**
 * Một nơi duy nhất quyết định hub nghe event nào và tên prop tương ứng.
 * @type {Readonly<Record<string, string>>}
 */
const HANDLER_PROP_BY_EVENT = Object.freeze({
  click: 'onClick',
  input: 'onInput',
  keydown: 'onKeydown',
});

/**
 * @param {string} eventType
 * @returns {string | undefined}
 */
export function handlerPropOf(eventType) {
  // hasOwn: tra thẳng object sẽ trả về hàm kế thừa với các tên như "constructor".
  return Object.hasOwn(HANDLER_PROP_BY_EVENT, eventType) ? HANDLER_PROP_BY_EVENT[eventType] : undefined;
}

/**
 * Đi từ `target` lên (không tính `root`) tới node đầu tiên có handler, rồi dừng.
 * @param {EventTarget | null} target
 * @param {Element} root
 * @param {string} eventType
 * @returns {((event: Event) => void) | null}
 */
export function findHandler(target, root, eventType) {
  const handlerProp = handlerPropOf(eventType);
  if (handlerProp === undefined) return null;

  let node = target instanceof Element ? target : null;
  while (node !== null && node !== root) {
    const handler = /** @type {import('./mini-react.js').VNode | undefined} */ (
      /** @type {{ _vnode?: unknown }} */ (node)._vnode
    )?.props[handlerProp];
    if (typeof handler === 'function') return /** @type {(event: Event) => void} */ (handler);
    node = node.parentElement;
  }
  return null;
}

/** Root đã gắn hub; gọi lại lần hai sẽ nhân đôi listener và mỗi click chạy handler hai lần. */
const delegatedRoots = new WeakSet();

/**
 * Đúng một listener cho mỗi loại event, gắn ở root. Listener sống qua mọi lần
 * `replaceChildren` vì nó nằm trên root, không nằm trên node bị thay.
 * @param {Element} root
 */
export function setupEventDelegation(root) {
  if (delegatedRoots.has(root)) return;
  delegatedRoots.add(root);

  for (const eventType of Object.keys(HANDLER_PROP_BY_EVENT)) {
    root.addEventListener(eventType, (event) => {
      findHandler(event.target, root, eventType)?.(event);
    });
  }
}
