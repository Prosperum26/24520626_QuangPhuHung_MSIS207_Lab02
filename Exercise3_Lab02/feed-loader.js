// @ts-check

const UNKNOWN_ERROR = 'Unknown error';

/**
 * `catch` cho `unknown`: chỉ đọc `.message` khi chắc chắn là Error.
 * @param {unknown} err
 * @returns {string}
 */
export function errorMessageOf(err) {
  const message = err instanceof Error ? err.message : err;
  return typeof message === 'string' && message !== '' ? message : UNKNOWN_ERROR;
}
