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

/** @typedef {import('./state-machine.js').FeedEvent} FeedEvent */
/** @typedef {import('./feed-mock.js').FetchFeed} FetchFeed */

/**
 * Chống race bằng request ID: chỉ phản hồi của lần `load` mới nhất được dispatch.
 * `latestId` nằm trong closure này, nên loader phải được tạo một lần, không tạo trong thân component.
 * @param {FetchFeed} fetchFeed
 */
export function createFeedLoader(fetchFeed) {
  let latestId = 0;

  /** @param {(event: FeedEvent) => void} dispatch */
  async function load(dispatch) {
    latestId += 1;
    const id = latestId;
    dispatch({ type: 'LOAD' });

    /** @type {FeedEvent} */
    let event;
    try {
      event = { type: 'RESOLVE', data: await fetchFeed() };
    } catch (err) {
      event = { type: 'REJECT', error: errorMessageOf(err) };
    }
    if (id === latestId) dispatch(event);
  }

  return { load };
}
