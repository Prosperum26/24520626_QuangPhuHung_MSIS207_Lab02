// @ts-check
import { available } from './inventory-fsm.js';

/** @typedef {import('./types.js').Inventory} Inventory */
/** @typedef {import('./types.js').EventInput} EventInput */
/** @typedef {import('./types.js').TransitionResult} TransitionResult */
/** @typedef {ReturnType<typeof import('./inventory-store.js').createInventoryStore>} Store */

export const DEFAULT_MAX_RETRIES = 10;

/**
 * Vòng đọc -> quyết định -> commit. Gặp CONFLICT thì đọc lại và thử lại, tối đa `maxRetries` lần thử lại.
 * Mỗi CONFLICT nghĩa là có người khác vừa đổi state, nên thử lại không bao giờ là vô ích.
 * @param {Store} store
 * @param {(snapshot: Inventory) => { event: EventInput } | { skip: string }} decide
 * @param {number} [maxRetries]
 * @returns {Promise<{ status: 'DONE', result: TransitionResult, state: Inventory, retries: number }
 *   | { status: 'SKIPPED', reason: string }
 *   | { status: 'GAVE_UP', retries: number }>}
 */
export async function commitWithRetry(store, decide, maxRetries = DEFAULT_MAX_RETRIES) {
  for (let retries = 0; retries <= maxRetries; retries += 1) {
    const snapshot = await store.read();
    const decision = decide(snapshot);
    if ('skip' in decision) return { status: 'SKIPPED', reason: decision.skip };
    const outcome = await store.commit(snapshot.version, decision.event);
    if (outcome.ok) return { status: 'DONE', result: outcome.result, state: outcome.state, retries };
  }
  return { status: 'GAVE_UP', retries: maxRetries };
}

/**
 * Giữ hàng. Thấy hết hàng thì dừng ngay, không commit vô ích.
 * @param {Store} store
 * @param {string} buyerId
 * @param {{ maxRetries?: number }} [options]
 * @returns {Promise<{ status: 'RESERVED', id: number, retries: number }
 *   | { status: 'SOLD_OUT' }
 *   | { status: 'REJECTED', reason: string }
 *   | { status: 'GAVE_UP' }>}
 */
export async function reserveWithRetry(store, buyerId, { maxRetries = DEFAULT_MAX_RETRIES } = {}) {
  const outcome = await commitWithRetry(
    store,
    (snapshot) => (available(snapshot) <= 0 ? { skip: 'SOLD_OUT' } : { event: { type: 'RESERVE', buyerId } }),
    maxRetries,
  );
  if (outcome.status === 'GAVE_UP') return { status: 'GAVE_UP' };
  if (outcome.status === 'SKIPPED') return { status: 'SOLD_OUT' };
  const { result, retries } = outcome;
  if (result.ok) return { status: 'RESERVED', id: /** @type {number} */ (result.id), retries };
  return result.reason === 'SOLD_OUT' ? { status: 'SOLD_OUT' } : { status: 'REJECTED', reason: result.reason };
}
