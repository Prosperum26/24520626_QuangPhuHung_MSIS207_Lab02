// @ts-check

// ---------- Contract (A1) ----------

/** Loại VNode dành riêng cho text; mọi leaf luôn được chuẩn hoá về loại này. */
export const TEXT_ELEMENT = 'TEXT_ELEMENT';

/**
 * `any` ở đây là chỗ duy nhất được phép (Context.md §3.2): props của function
 * component do từng component tự định nghĩa.
 * @typedef {string | ((props: any) => VNode)} VNodeType
 */

/**
 * @typedef {object} VNodeProps
 * @property {readonly VNode[]} children Luôn là mảng, kể cả khi rỗng.
 * @property {string} [nodeValue] Chỉ có ở TEXT_ELEMENT.
 * @property {string | number} [key]
 */

/**
 * @typedef {object} VNode
 * @property {VNodeType} type Tag, function component hoặc TEXT_ELEMENT.
 * @property {Readonly<VNodeProps & Record<string, unknown>>} props
 */

/**
 * Thứ người gọi được phép truyền làm child trước khi chuẩn hoá.
 * @typedef {VNode | string | number | boolean | null | undefined | ChildInput[]} ChildInput
 */

// ---------- Factory (A2, A3) ----------

/**
 * @param {string | number} text
 * @returns {VNode}
 */
export function createTextElement(text) {
  return Object.freeze({
    type: TEXT_ELEMENT,
    props: Object.freeze({
      nodeValue: String(text),
      children: Object.freeze([]),
    }),
  });
}

/**
 * Lọc ở một chỗ: bỏ null/undefined và mọi boolean để `cond && <X />` không
 * in ra chữ "false"/"true". Số 0 và chuỗi rỗng vẫn được giữ.
 * @param {unknown} child
 */
function isRenderable(child) {
  return child !== null && child !== undefined && typeof child !== 'boolean';
}

/**
 * @param {VNode | string | number} child
 * @returns {VNode}
 */
function toVNode(child) {
  return typeof child === 'object' ? child : createTextElement(child);
}

/**
 * @param {VNodeType} type
 * @param {Record<string, unknown> | null | undefined} props
 * @param {...ChildInput} children
 * @returns {VNode}
 */
export function createElement(type, props, ...children) {
  // Ép về unknown[] vì kiểu đệ quy ChildInput làm TS không suy ra nổi kết quả của flat(Infinity).
  const normalized = /** @type {unknown[]} */ (children)
    .flat(Infinity)
    .filter(isRenderable)
    .map((child) => toVNode(/** @type {VNode | string | number} */ (child)));

  return Object.freeze({
    type,
    props: Object.freeze({
      ...props,
      children: Object.freeze(normalized),
    }),
  });
}

// ---------- Mounting (B1-B4) ----------

/** Prop không bao giờ thành attribute: children đi đường đệ quy, nodeValue đi đường text. */
const RESERVED_PROPS = new Set(['children', 'nodeValue', 'key']);

/**
 * Mọi prop bắt đầu bằng "on" là event. Chặn tại đây để chuỗi `onclick="..."` từ
 * dữ liệu ngoài không bao giờ thành inline handler (project-rules §3).
 * @param {string} name
 */
function isEventProp(name) {
  return name.startsWith('on');
}

/**
 * `onClick` thành `click`. Đổi quy ước tên event ở đây.
 * @param {string} name
 */
function eventNameOf(name) {
  return name.slice(2).toLowerCase();
}

/**
 * Chỗ duy nhất quyết định prop thành gì trên DOM thật.
 * @param {Element} dom
 * @param {string} name
 * @param {unknown} value
 */
function applyProp(dom, name, value) {
  if (RESERVED_PROPS.has(name)) return;

  if (isEventProp(name)) {
    // Gắn trực tiếp từng node; event delegation tập trung là việc của Exercise 2.
    if (typeof value === 'function') {
      dom.addEventListener(eventNameOf(name), /** @type {EventListener} */ (value));
    }
    return;
  }

  if (value === null || value === undefined || value === false) return;

  const attributeName = name === 'className' ? 'class' : name;
  dom.setAttribute(attributeName, value === true ? '' : String(value));
}

/**
 * @param {unknown} value
 * @returns {value is VNode}
 */
function isVNode(value) {
  if (typeof value !== 'object' || value === null) return false;
  const { type, props } = /** @type {Partial<VNode>} */ (value);
  const hasValidType = typeof type === 'string' || typeof type === 'function';
  return hasValidType && typeof props === 'object' && props !== null && Array.isArray(props.children);
}

/**
 * Chỉ dùng createTextNode / createElement / setAttribute, không đụng
 * innerHTML, nên mọi chuỗi trong VNode đều là text thuần (chống XSS).
 * @param {VNode} vNode
 * @returns {Node}
 */
export function renderToDOM(vNode) {
  if (!isVNode(vNode)) {
    throw new TypeError(`renderToDOM expects a VNode, received: ${String(vNode)}`);
  }

  if (vNode.type === TEXT_ELEMENT) {
    return document.createTextNode(vNode.props.nodeValue ?? '');
  }

  if (typeof vNode.type === 'function') {
    return renderToDOM(vNode.type(vNode.props));
  }

  const dom = document.createElement(vNode.type);
  for (const [name, value] of Object.entries(vNode.props)) {
    applyProp(dom, name, value);
  }
  dom.append(...vNode.props.children.map(renderToDOM));
  return dom;
}
