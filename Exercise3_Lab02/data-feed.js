// @ts-check
import { createFeedLoader } from './feed-loader.js';
import { createElement } from './mini-react.js';
import { useState } from './reactive-engine.js';
import { STATUS, initialState, transition } from './state-machine.js';

const HEADING_ID = 'feed-heading';
const LOAD_BUTTON_ID = 'load-feed';

/**
 * @param {import('./state-machine.js').ViewState} state
 */
function renderContent(state) {
  if (state.status === STATUS.IDLE) {
    return createElement('p', null, 'Press Load feed to start.');
  }
  return null;
}

/**
 * Loader tạo một lần ở đây, ngoài `DataFeed`: component chạy lại mỗi render,
 * tạo trong thân hàm sẽ reset `latestId` và mất bảo vệ race.
 * @param {{ fetchFeed: import('./feed-mock.js').FetchFeed }} deps
 */
export function createDataFeed({ fetchFeed }) {
  const loader = createFeedLoader(fetchFeed);

  return function DataFeed() {
    const [state, setState] = useState(initialState);

    /** @param {import('./state-machine.js').FeedEvent} event */
    const dispatch = (event) => setState((prev) => transition(prev, event));
    const onLoad = () => {
      loader.load(dispatch);
    };

    return createElement(
      'section',
      { 'aria-labelledby': HEADING_ID, className: 'data-feed' },
      createElement(
        'header',
        null,
        // tabindex -1: focus được bằng script khi nút Retry bị gỡ, nhưng không nằm trong thứ tự Tab.
        createElement('h1', { id: HEADING_ID, tabindex: '-1' }, 'Data Feed'),
        createElement('button', { id: LOAD_BUTTON_ID, type: 'button', onClick: onLoad }, 'Load feed'),
      ),
      createElement('div', { className: 'feed-region' }, renderContent(state)),
    );
  };
}
