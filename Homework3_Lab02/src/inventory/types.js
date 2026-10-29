// @ts-check

// Mọi hằng số nghiệp vụ nằm ở đây để đổi một chỗ (xem TASK_DECOMPOSITION mục 3.2).
export const HOLD_MS = 120_000;
export const CHECKOUT_MS = 60_000;
export const EXTEND_MS = 60_000;
export const MAX_EXTENSIONS = 2;

/** @typedef {'RESERVED'|'CHECKOUT'|'SOLD'|'EXPIRED'|'CANCELLED'} ReservationStatus */

/**
 * @typedef {Object} Reservation
 * @property {number} id                 tăng dần, duy nhất trong một kho
 * @property {string} buyerId
 * @property {ReservationStatus} status
 * @property {number} expiresAt          ms theo giờ máy chủ; mốc hết hạn của RESERVED và CHECKOUT
 * @property {number} extensions         số lần đã gia hạn, tối đa MAX_EXTENSIONS
 */

/**
 * @typedef {Object} Inventory
 * @property {number} total
 * @property {number} sold               số lượt ở trạng thái SOLD
 * @property {number} version            tăng 1 mỗi lần state thật sự đổi
 * @property {{ startsAt: number, endsAt: number }} saleWindow
 * @property {ReadonlyArray<Readonly<Reservation>>} reservations
 */

/**
 * @typedef {{ type: 'RESERVE', buyerId: string, now: number }
 *   | { type: 'BEGIN_CHECKOUT', id: number, now: number }
 *   | { type: 'PAY_SUCCESS', id: number, now: number }
 *   | { type: 'PAY_FAIL', id: number, now: number }
 *   | { type: 'EXTEND', id: number, now: number }
 *   | { type: 'CANCEL', id: number, now: number }
 *   | { type: 'EXPIRE_DUE', now: number }} InventoryEvent
 */

/**
 * Event chưa có `now`: store gắn giờ máy chủ lúc commit, client không tự khai giờ.
 * @typedef {InventoryEvent extends infer E ? (E extends unknown ? Omit<E, 'now'> : never) : never} EventInput
 */

/**
 * @typedef {{ ok: true, id?: number }
 *   | { ok: false, reason: 'SALE_NOT_LIVE'|'SOLD_OUT'|'NOT_FOUND'|'INVALID_TRANSITION'|'HOLD_EXPIRED'|'EXTENSION_LIMIT' }} TransitionResult
 */

/**
 * @typedef {{ ok: true, state: Inventory, result: TransitionResult }
 *   | { ok: false, reason: 'CONFLICT', current: Inventory }} CommitResult
 */
