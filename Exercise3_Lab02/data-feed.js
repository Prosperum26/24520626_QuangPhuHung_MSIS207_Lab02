// @ts-check
import { createFeedLoader } from './feed-loader.js';
import { createElement } from './mini-react.js';
import { useState } from './reactive-engine.js';
import { STATUS, initialState, transition } from './state-machine.js';

const HEADING_ID = 'feed-heading';
const LOAD_BUTTON_ID = 'load-feed';
const RETRY_BUTTON_ID = 'retry-feed';
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

/** @param {readonly import('./state-machine.js').Item[]} items */
function renderItems(items) {
  if (items.length === 0) return createElement('p', null, 'No items to show.');
  return createElement(
    'ul',
    { className: 'feed-list' },
    ...items.map((item) =>
      createElement(
        'li',
        { key: item.id },
        createElement('h2', null, item.title),
        createElement('p', null, item.summary),
      ),
    ),
  );
}

/**
 * role="alert" trên node mới chèn để trình đọc màn hình đọc ngay; có tiêu đề chữ nên không chỉ dựa vào màu.
 * @param {string} message
 * @param {() => void} onRetry
 */
function renderError(message, onRetry) {
  return createElement(
    'div',
    { className: 'feed-error', role: 'alert' },
    createElement('h2', null, "Couldn't load the feed"),
    createElement('p', null, message),
    createElement('button', { id: RETRY_BUTTON_ID, type: 'button', onClick: onRetry }, 'Retry Connection'),
  );
}

/**
 * @param {import('./state-machine.js').ViewState} state
 * @param {{ onRetry: () => void }} handlers
 */
function renderContent(state, { onRetry }) {
  if (state.status === STATUS.IDLE) {
    return createElement('p', null, 'Press Load feed to start.');
  }
  if (state.status === STATUS.LOADING) return renderSkeleton();
  if (state.status === STATUS.SUCCESS) return renderItems(state.data);
  return renderError(state.error, onRetry);
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
      if (event.type === 'RESOLVE') announce(`Loaded ${event.data.length} ${event.data.length === 1 ? 'item' : 'items'}`);
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
        renderContent(state, { onRetry: onLoad }),
      ),
    );
  };
}
