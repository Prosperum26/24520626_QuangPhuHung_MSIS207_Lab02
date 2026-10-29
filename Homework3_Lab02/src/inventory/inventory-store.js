// @ts-check
import { transition } from './inventory-fsm.js';

/** @typedef {import('./types.js').Inventory} Inventory */
/** @typedef {import('./types.js').EventInput} EventInput */
/** @typedef {import('./types.js').CommitResult} CommitResult */

/**
 * Kho "máy chủ" giả lập: state chỉ đổi trong commit(), và commit chỉ nhận nếu version khớp.
 * Khóa lạc quan = không giữ khóa lúc đọc; ai commit sau với version cũ thì bị CONFLICT và phải đọc lại.
 * `delay` mô phỏng độ trễ mạng: JS đơn luồng nên race chỉ xảy ra giữa các `await`.
 * @param {{ initial: Inventory, now: () => number, delay?: () => Promise<void> }} deps
 */
export function createInventoryStore({ initial, now, delay = async () => {} }) {
  let state = initial;
  let conflicts = 0;

  /** @returns {Promise<Inventory>} state là bất biến (đã freeze) nên trả thẳng, không cần sao chép */
  async function read() {
    await delay();
    return state;
  }

  /**
   * @param {number} expectedVersion version client thấy lúc đọc
   * @param {EventInput} event
   * @returns {Promise<CommitResult>}
   */
  async function commit(expectedVersion, event) {
    await delay();
    // Từ đây tới return không có await: kiểm version và ghi state là một bước không bị xen ngang.
    if (state.version !== expectedVersion) {
      conflicts += 1;
      return { ok: false, reason: 'CONFLICT', current: state };
    }
    const out = transition(state, /** @type {import('./types.js').InventoryEvent} */ ({ ...event, now: now() }));
    state = out.state;
    return { ok: true, state, result: out.result };
  }

  return { read, commit, stats: () => ({ conflicts }) };
}
