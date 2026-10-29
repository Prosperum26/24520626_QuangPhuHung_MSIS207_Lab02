// @ts-check
import { CHECKOUT_MS, EXTEND_MS, HOLD_MS, MAX_EXTENSIONS } from './types.js';

/** @typedef {import('./types.js').Inventory} Inventory */
/** @typedef {import('./types.js').Reservation} Reservation */
/** @typedef {import('./types.js').InventoryEvent} InventoryEvent */
/** @typedef {import('./types.js').TransitionResult} TransitionResult */

/** @param {Reservation} r */
const isActive = (r) => r.status === 'RESERVED' || r.status === 'CHECKOUT';

/**
 * @param {Omit<Inventory, 'reservations'> & { reservations: Reservation[] }} draft
 * @returns {Inventory}
 */
function freezeState(draft) {
  return Object.freeze({
    ...draft,
    saleWindow: Object.freeze({ ...draft.saleWindow }),
    reservations: Object.freeze(draft.reservations.map((r) => Object.freeze({ ...r }))),
  });
}

/**
 * @param {{ total: number, saleWindow: { startsAt: number, endsAt: number } }} config
 * @returns {Inventory}
 */
export function createInventory({ total, saleWindow }) {
  return freezeState({ total, sold: 0, version: 0, saleWindow, reservations: [] });
}

/** Số lượt đang giữ hàng (RESERVED hoặc CHECKOUT). */
export function countHeld(/** @type {Inventory} */ state) {
  return state.reservations.filter(isActive).length;
}

/** Hàng còn có thể giữ. Suy ra từ state, không lưu riêng để khỏi lệch. */
export function available(/** @type {Inventory} */ state) {
  return state.total - state.sold - countHeld(state);
}

/**
 * Lazy expiry: lượt giữ quá hạn bị đánh dấu EXPIRED dựa trên `now`, không chờ timer giao diện.
 * Biên bao gồm: now === expiresAt là đã hết hạn.
 * @param {Inventory} state
 * @param {number} now
 * @returns {Inventory} chính `state` nếu không có gì hết hạn
 */
function sweepExpired(state, now) {
  let changed = false;
  const reservations = state.reservations.map((r) => {
    if (isActive(r) && now >= r.expiresAt) {
      changed = true;
      return { ...r, status: /** @type {const} */ ('EXPIRED') };
    }
    return r;
  });
  return changed ? freezeState({ ...state, reservations }) : state;
}

/** @param {Inventory} state @param {number} id @param {(r: Reservation) => Reservation} change */
function updateReservation(state, id, change) {
  return { ...state, reservations: state.reservations.map((r) => (r.id === id ? change(r) : r)) };
}

/**
 * Bảng chuyển trạng thái: nơi duy nhất quyết định event nào hợp lệ (xem TASK_DECOMPOSITION mục 3.2).
 * Trả state chưa tăng version; `transition` lo phần version.
 * @param {Inventory} state đã quét hết hạn
 * @param {InventoryEvent} event
 * @returns {{ state: Inventory, result: TransitionResult }}
 */
function apply(state, event) {
  /** @param {TransitionResult & { ok: false }} result */
  const reject = (result) => ({ state, result });

  if (event.type === 'RESERVE') {
    const { startsAt, endsAt } = state.saleWindow;
    if (event.now < startsAt || event.now >= endsAt) return reject({ ok: false, reason: 'SALE_NOT_LIVE' });
    if (available(state) <= 0) return reject({ ok: false, reason: 'SOLD_OUT' });
    const id = state.reservations.length + 1;
    const reservation = { id, buyerId: event.buyerId, status: /** @type {const} */ ('RESERVED'), expiresAt: event.now + HOLD_MS, extensions: 0 };
    const next = freezeState({ ...state, reservations: [...state.reservations, reservation] });
    return { state: next, result: { ok: true, id } };
  }

  // Các event còn lại (trừ EXPIRE_DUE, xử lý ở transition) đều nhắm vào một lượt giữ có sẵn.
  const target = state.reservations.find((r) => r.id === /** @type {{ id: number }} */ (event).id);
  if (!target) return reject({ ok: false, reason: 'NOT_FOUND' });
  // Lượt đã bị quét hết hạn trước event này: báo HOLD_EXPIRED để người dùng biết vì sao, không phải "sai trạng thái".
  if (target.status === 'EXPIRED') return reject({ ok: false, reason: 'HOLD_EXPIRED' });
  if (!isActive(target)) return reject({ ok: false, reason: 'INVALID_TRANSITION' });

  const done = (/** @type {Inventory} */ next) => ({ state: freezeState(next), result: /** @type {TransitionResult} */ ({ ok: true, id: target.id }) });

  switch (event.type) {
    case 'BEGIN_CHECKOUT':
      if (target.status !== 'RESERVED') return reject({ ok: false, reason: 'INVALID_TRANSITION' });
      return done(updateReservation(state, target.id, (r) => ({ ...r, status: 'CHECKOUT', expiresAt: event.now + CHECKOUT_MS })));
    case 'EXTEND':
      if (target.status !== 'RESERVED') return reject({ ok: false, reason: 'INVALID_TRANSITION' });
      if (target.extensions >= MAX_EXTENSIONS) return reject({ ok: false, reason: 'EXTENSION_LIMIT' });
      return done(updateReservation(state, target.id, (r) => ({ ...r, expiresAt: r.expiresAt + EXTEND_MS, extensions: r.extensions + 1 })));
    case 'PAY_SUCCESS':
      if (target.status !== 'CHECKOUT') return reject({ ok: false, reason: 'INVALID_TRANSITION' });
      return done({ ...updateReservation(state, target.id, (r) => ({ ...r, status: 'SOLD' })), sold: state.sold + 1 });
    case 'PAY_FAIL':
      if (target.status !== 'CHECKOUT') return reject({ ok: false, reason: 'INVALID_TRANSITION' });
      return done(updateReservation(state, target.id, (r) => ({ ...r, status: 'CANCELLED' })));
    case 'CANCEL':
      return done(updateReservation(state, target.id, (r) => ({ ...r, status: 'CANCELLED' })));
    default:
      return reject({ ok: false, reason: 'INVALID_TRANSITION' });
  }
}

/** @param {Inventory} state @returns {Inventory} */
const bumpVersion = (state) => freezeState({ ...state, version: state.version + 1 });

/**
 * Hàm duy nhất thay đổi kho. Thuần: không sửa `state` cũ, không đọc đồng hồ (giờ đi vào qua event.now).
 * Version tăng 1 khi state thật sự đổi (event được chấp nhận, hoặc việc quét hết hạn làm đổi state).
 * @param {Inventory} state
 * @param {InventoryEvent} event
 * @returns {{ state: Inventory, result: TransitionResult }}
 */
export function transition(state, event) {
  const swept = sweepExpired(state, event.now);

  if (event.type === 'EXPIRE_DUE') {
    return { state: swept === state ? state : bumpVersion(swept), result: { ok: true } };
  }

  const outcome = apply(swept, event);
  if (outcome.result.ok) return { state: bumpVersion(outcome.state), result: outcome.result };
  // Bị từ chối nhưng quét hết hạn đã đổi state: vẫn phải lưu, nếu không lượt quá hạn sẽ "sống lại".
  return { state: swept === state ? state : bumpVersion(swept), result: outcome.result };
}

/**
 * Bất biến runtime (SystemContract). version chỉ-tăng được kiểm ở test vì cần hai state.
 * @param {Inventory} state
 * @returns {boolean}
 */
export function verifyInvariants(state) {
  const soldCount = state.reservations.filter((r) => r.status === 'SOLD').length;
  const ids = new Set(state.reservations.map((r) => r.id));
  return (
    state.sold === soldCount &&
    state.sold + countHeld(state) <= state.total &&
    ids.size === state.reservations.length &&
    Number.isInteger(state.version) &&
    state.version >= 0
  );
}
