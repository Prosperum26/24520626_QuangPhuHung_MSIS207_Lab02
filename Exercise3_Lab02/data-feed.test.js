import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDataFeed } from './data-feed.js';
import { FEED_ITEMS, createDeferredFeed } from './feed-mock.js';
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

describe('LOADING (C2)', () => {
  it('shows an aria-hidden skeleton with no text and marks the region busy', () => {
    const { root } = setup();
    root.querySelector('#load-feed').click();
    const skeleton = root.querySelector('.skeleton');
    expect(skeleton.getAttribute('aria-hidden')).toBe('true');
    expect(skeleton.textContent).toBe('');
    expect(skeleton.children.length).toBe(3);
    expect(root.querySelector('.feed-region').getAttribute('aria-busy')).toBe('true');
    expect(root.textContent).not.toContain('Press Load feed');
  });

  it('announces loading in the persistent status region', () => {
    const { root, status } = setup();
    root.querySelector('#load-feed').click();
    expect(status.textContent).toBe('Loading feed');
  });

  it('relabels the button to Reload feed once started', () => {
    const { root } = setup();
    root.querySelector('#load-feed').click();
    expect(root.querySelector('#load-feed').textContent).toBe('Reload feed');
  });

  it('is not busy in IDLE', () => {
    const { root } = setup();
    expect(root.querySelector('.feed-region').hasAttribute('aria-busy')).toBe(false);
  });
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Bấm Load feed rồi resolve lần gọi cuối với `items`. */
async function loadWith(t, items) {
  t.root.querySelector('#load-feed').click();
  t.calls[t.calls.length - 1].resolve(items);
  await flush();
}

describe('SUCCESS (C3)', () => {
  it('renders one li per item, in order, keyed by item.id', async () => {
    const t = setup();
    await loadWith(t, FEED_ITEMS);
    const rows = [...t.root.querySelectorAll('ul > li')];
    expect(rows.map((li) => li.querySelector('h2').textContent)).toEqual(FEED_ITEMS.map((i) => i.title));
    expect(rows.map((li) => li._vnode.props.key)).toEqual(FEED_ITEMS.map((i) => i.id));
    expect(t.root.querySelector('.skeleton')).toBeNull();
    expect(t.root.querySelector('.feed-region').hasAttribute('aria-busy')).toBe(false);
  });

  it('shows a message instead of an empty list', async () => {
    const t = setup();
    await loadWith(t, []);
    expect(t.root.querySelector('ul')).toBeNull();
    expect(t.root.textContent).toContain('No items to show.');
  });

  it('renders HTML in item text as plain text', async () => {
    const t = setup();
    await loadWith(t, [{ id: 'x', title: '<img src=x onerror=alert(1)>', summary: '<b>bold</b>' }]);
    expect(t.root.querySelector('img')).toBeNull();
    expect(t.root.querySelector('b')).toBeNull();
    expect(t.root.querySelector('li h2').textContent).toBe('<img src=x onerror=alert(1)>');
  });

  it('announces how many items loaded', async () => {
    const t = setup();
    await loadWith(t, FEED_ITEMS);
    expect(t.status.textContent).toBe('Loaded 3 items');
  });

  it('drops the old items when reloading (no stale data beside the skeleton)', async () => {
    const t = setup();
    await loadWith(t, FEED_ITEMS);
    t.root.querySelector('#load-feed').click();
    expect(t.root.querySelector('ul')).toBeNull();
    expect(t.root.querySelector('.skeleton')).not.toBeNull();
    expect(t.root.textContent).not.toContain(FEED_ITEMS[0].title);
  });
});
