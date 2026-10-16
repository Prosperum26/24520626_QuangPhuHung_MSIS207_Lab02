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

/** Bấm Load feed rồi reject lần gọi cuối. */
async function failWith(t, error) {
  t.root.querySelector('#load-feed').click();
  t.calls[t.calls.length - 1].reject(error);
  await flush();
}

describe('ERROR and Retry Connection (C4)', () => {
  it('shows a readable alert with the message and a Retry Connection button', async () => {
    const t = setup();
    await failWith(t, new Error('Network down'));
    const alert = t.root.querySelector('[role="alert"]');
    expect(alert.querySelector('h2').textContent).toBe("Couldn't load the feed");
    expect(alert.textContent).toContain('Network down');
    expect(alert.querySelector('button#retry-feed').textContent).toBe('Retry Connection');
    expect(t.root.querySelector('.skeleton')).toBeNull();
  });

  it('Retry goes through LOADING and then shows the data', async () => {
    const t = setup();
    await failWith(t, new Error('Network down'));
    t.root.querySelector('#retry-feed').click();
    expect(t.calls).toHaveLength(2);
    expect(t.root.querySelector('.skeleton')).not.toBeNull();
    expect(t.root.querySelector('[role="alert"]')).toBeNull();
    t.calls[1].resolve(FEED_ITEMS);
    await flush();
    expect(t.root.querySelectorAll('ul > li')).toHaveLength(FEED_ITEMS.length);
    expect(t.root.querySelector('[role="alert"]')).toBeNull();
  });

  it('a failing retry returns to ERROR', async () => {
    const t = setup();
    await failWith(t, new Error('first'));
    t.root.querySelector('#retry-feed').click();
    t.calls[1].reject(new Error('second'));
    await flush();
    expect(t.root.querySelector('[role="alert"]').textContent).toContain('second');
  });

  it('renders HTML in the error message as plain text', async () => {
    const t = setup();
    await failWith(t, new Error('<b>x</b>'));
    expect(t.root.querySelector('[role="alert"] b')).toBeNull();
    expect(t.root.querySelector('[role="alert"]').textContent).toContain('<b>x</b>');
  });

  it('falls back to a default message for a non-Error rejection', async () => {
    const t = setup();
    await failWith(t, undefined);
    expect(t.root.querySelector('[role="alert"]').textContent).toContain('Unknown error');
  });
});

describe('focus (C5)', () => {
  it('keeps focus on the Load feed button through LOADING and SUCCESS', async () => {
    const t = setup();
    t.root.querySelector('#load-feed').focus();
    t.root.querySelector('#load-feed').click();
    expect(document.activeElement.id).toBe('load-feed');
    t.calls[0].resolve(FEED_ITEMS);
    await flush();
    expect(document.activeElement.id).toBe('load-feed');
  });

  it('moves focus to the heading when the Retry button is removed', async () => {
    const t = setup();
    await failWith(t, new Error('Network down'));
    t.root.querySelector('#retry-feed').focus();
    t.root.querySelector('#retry-feed').click();
    expect(t.root.querySelector('#retry-feed')).toBeNull();
    expect(document.activeElement.id).toBe('feed-heading');
  });

  it('does not steal focus from a control the user is on', async () => {
    const t = setup();
    await failWith(t, new Error('Network down'));
    t.root.querySelector('#load-feed').focus();
    t.root.querySelector('#retry-feed').click();
    expect(document.activeElement.id).toBe('load-feed');
  });
});
