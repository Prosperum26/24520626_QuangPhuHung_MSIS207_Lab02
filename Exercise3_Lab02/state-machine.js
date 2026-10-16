// @ts-check

/**
 * @typedef {object} Item
 * @property {string} id
 * @property {string} title
 * @property {string} summary
 */

/**
 * Đúng 4 hình dạng theo đề; không thêm trường (kể cả requestId, xem loader).
 * @typedef {{ status: 'IDLE' }
 *   | { status: 'LOADING' }
 *   | { status: 'SUCCESS', data: Item[] }
 *   | { status: 'ERROR', error: string }} ViewState
 */

/**
 * @typedef {{ type: 'LOAD' }
 *   | { type: 'RESOLVE', data: Item[] }
 *   | { type: 'REJECT', error: string }} FeedEvent
 */

export const STATUS = Object.freeze({
  IDLE: 'IDLE',
  LOADING: 'LOADING',
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR',
});

/** @type {ViewState} */
export const initialState = Object.freeze({ status: STATUS.IDLE });

const LOADING = Object.freeze({ status: STATUS.LOADING });

/**
 * Hàm thuần: cùng (state, event) luôn ra cùng kết quả. Cặp không có trong bảng
 * trả về chính `state` để setter (Object.is) khỏi render thừa.
 * @param {ViewState} state
 * @param {FeedEvent} event
 * @returns {ViewState}
 */
export function transition(state, event) {
  if (event.type === 'LOAD') return LOADING;
  if (state.status !== STATUS.LOADING) return state;
  if (event.type === 'RESOLVE') return Object.freeze({ status: STATUS.SUCCESS, data: event.data });
  if (event.type === 'REJECT') return Object.freeze({ status: STATUS.ERROR, error: event.error });
  return state;
}
