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
