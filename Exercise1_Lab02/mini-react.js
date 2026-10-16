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
