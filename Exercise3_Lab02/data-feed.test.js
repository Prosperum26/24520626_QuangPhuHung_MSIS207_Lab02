import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDataFeed } from './data-feed.js';
import { createDeferredFeed } from './feed-mock.js';
import { renderApp, resetCursor, setRenderer, setupEventDelegation, stateStore } from './reactive-engine.js';

beforeEach(() => {
  stateStore.length = 0;
  resetCursor();
  setRenderer(null);
});

/** Dựng app vào body giống index.html: #status nằm ngoài root. */
function setup() {
  document.body.replaceChildren();
  const root = document.createElement('div');
  const status = document.createElement('p');
  status.id = 'status';
  status.setAttribute('role', 'status');
  document.body.append(root, status);
  setupEventDelegation(root);
  const feed = createDeferredFeed();
  renderApp(createDataFeed({ fetchFeed: feed.fetchFeed }), root);
  return { root, status, ...feed };
}

describe('IDLE (C1)', () => {
  it('renders a start prompt and a Load feed button without fetching', () => {
    const { root, calls } = setup();
    expect(root.querySelector('h1').textContent).toBe('Data Feed');
    expect(root.querySelector('#load-feed').textContent).toBe('Load feed');
    expect(root.textContent).toContain('Press Load feed to start.');
    expect(calls).toHaveLength(0);
  });

  it('clicking Load feed calls fetchFeed once', () => {
    const { root, calls } = setup();
    root.querySelector('#load-feed').click();
    expect(calls).toHaveLength(1);
  });

  it('attaches no listener to the button, only the root hub does', () => {
    const owners = new Set();
    const original = Element.prototype.addEventListener;
    Element.prototype.addEventListener = function (...args) {
      owners.add(this);
      return original.apply(this, args);
    };
    try {
      const { root } = setup();
      expect([...owners]).toEqual([root]);
    } finally {
      Element.prototype.addEventListener = original;
    }
  });
});
