// @ts-check
import { createFeedLoader } from './feed-loader.js';
import { createElement } from './mini-react.js';
import { useState } from './reactive-engine.js';
import { STATUS, initialState, transition } from './state-machine.js';

const HEADING_ID = 'feed-heading';
const LOAD_BUTTON_ID = 'load-feed';
const STATUS_ID = 'status';
const SKELETON_ROWS = 3;

/**
 * Vùng `role="status"` nằm ngoài cây bị thay (index.html): vùng live bị tạo lại
 * mỗi render thường không được trình đọc màn hình đọc ra (WCAG 4.1.3).
 * @param {string} message
 */
function announce(message) {
  const region = document.getElementById(STATUS_ID);
  if (region !== null) region.textContent = message;
}

/** Khung xương thuần trang trí: không chữ, ẩn khỏi trình đọc màn hình. */
function renderSkeleton() {
  const rows = Array.from({ length: SKELETON_ROWS }, () => createElement('div', { className: 'skeleton__row' }));
  return createElement('div', { className: 'skeleton', 'aria-hidden': 'true' }, ...rows);
}

/**
 * @param {import('./state-machine.js').ViewState} state
 */
function renderContent(state) {
  if (state.status === STATUS.IDLE) {
    return createElement('p', null, 'Press Load feed to start.');
  }
  if (state.status === STATUS.LOADING) return renderSkeleton();
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
    const dispatch = (event) => {
      if (event.type === 'LOAD') announce('Loading feed');
      setState((prev) => transition(prev, event));
    };
    const onLoad = () => {
      loader.load(dispatch);
    };
    const loadLabel = state.status === STATUS.IDLE ? 'Load feed' : 'Reload feed';

    return createElement(
      'section',
      { 'aria-labelledby': HEADING_ID, className: 'data-feed' },
      createElement(
        'header',
        null,
        // tabindex -1: focus được bằng script khi nút Retry bị gỡ, nhưng không nằm trong thứ tự Tab.
        createElement('h1', { id: HEADING_ID, tabindex: '-1' }, 'Data Feed'),
        createElement('button', { id: LOAD_BUTTON_ID, type: 'button', onClick: onLoad }, loadLabel),
      ),
      createElement(
        'div',
        { className: 'feed-region', 'aria-busy': state.status === STATUS.LOADING ? 'true' : null },
        renderContent(state),
      ),
    );
  };
}
