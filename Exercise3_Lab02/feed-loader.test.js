import { describe, expect, it, vi } from 'vitest';
import { createFeedLoader, errorMessageOf } from './feed-loader.js';
import { createDeferredFeed } from './feed-mock.js';
import { initialState, transition } from './state-machine.js';

describe('errorMessageOf (B4)', () => {
  it('reads message from an Error', () => {
    expect(errorMessageOf(new Error('Network down'))).toBe('Network down');
  });

  it('accepts a plain string', () => {
    expect(errorMessageOf('boom')).toBe('boom');
  });

  it.each([undefined, null, 42, { message: 'fake' }, new Error(''), ''])('falls back for %j', (value) => {
    expect(errorMessageOf(value)).toBe('Unknown error');
  });
});

const dataA = [{ id: 'a', title: 'A', summary: 'from request 1' }];
const dataB = [{ id: 'b', title: 'B', summary: 'from request 2' }];
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Loader thật + transition thật; dispatch spy để quan sát cả trạng thái lẫn lịch sử sự kiện. */
function setup() {
  const feed = createDeferredFeed();
  const loader = createFeedLoader(feed.fetchFeed);
  const view = { state: initialState };
  const dispatch = vi.fn((event) => {
    view.state = transition(view.state, event);
  });
  return { ...feed, loader, view, dispatch, load: () => loader.load(dispatch) };
}

describe('createFeedLoader (B5)', () => {
  it('1. happy path: LOADING then SUCCESS with the data', async () => {
    const t = setup();
    t.load();
    expect(t.view.state).toEqual({ status: 'LOADING' });
    t.calls[0].resolve(dataA);
    await flush();
    expect(t.view.state).toEqual({ status: 'SUCCESS', data: dataA });
  });

  it('2a. rejects with an Error -> ERROR with its message', async () => {
    const t = setup();
    t.load();
    t.calls[0].reject(new Error('Network down'));
    await flush();
    expect(t.view.state).toEqual({ status: 'ERROR', error: 'Network down' });
  });

  it('2b. rejects with a non-Error -> ERROR with the default message', async () => {
    const t = setup();
    t.load();
    t.calls[0].reject(undefined);
    await flush();
    expect(t.view.state).toEqual({ status: 'ERROR', error: 'Unknown error' });
  });

  it('2c. fetchFeed throwing synchronously still ends in ERROR', async () => {
    const view = { state: initialState };
    const loader = createFeedLoader(() => {
      throw new Error('sync boom');
    });
    await loader.load((event) => {
      view.state = transition(view.state, event);
    });
    expect(view.state).toEqual({ status: 'ERROR', error: 'sync boom' });
  });

  it('3. stale response arriving late is ignored', async () => {
    const t = setup();
    t.load();
    t.load();
    t.calls[1].resolve(dataB);
    await flush();
    t.calls[0].resolve(dataA);
    await flush();
    expect(t.view.state).toEqual({ status: 'SUCCESS', data: dataB });
    expect(t.dispatch.mock.calls.filter(([e]) => e.type === 'RESOLVE')).toHaveLength(1);
  });

  it('4. stale response arriving early leaves LOADING until the latest settles', async () => {
    const t = setup();
    t.load();
    t.load();
    t.calls[0].resolve(dataA);
    await flush();
    expect(t.view.state).toEqual({ status: 'LOADING' });
    t.calls[1].resolve(dataB);
    await flush();
    expect(t.view.state).toEqual({ status: 'SUCCESS', data: dataB });
  });

  it('5. stale error arriving late does not replace a newer SUCCESS', async () => {
    const t = setup();
    t.load();
    t.load();
    t.calls[1].resolve(dataB);
    await flush();
    t.calls[0].reject(new Error('old failure'));
    await flush();
    expect(t.view.state).toEqual({ status: 'SUCCESS', data: dataB });
  });

  it('6. stale error arriving while the newer request is pending leaves LOADING', async () => {
    const t = setup();
    t.load();
    t.load();
    t.calls[0].reject(new Error('old failure'));
    await flush();
    expect(t.view.state).toEqual({ status: 'LOADING' });
  });

  it('7. retry after an error goes ERROR -> LOADING -> SUCCESS', async () => {
    const t = setup();
    t.load();
    t.calls[0].reject(new Error('Network down'));
    await flush();
    expect(t.view.state.status).toBe('ERROR');
    t.load();
    expect(t.view.state).toEqual({ status: 'LOADING' });
    t.calls[1].resolve(dataA);
    await flush();
    expect(t.view.state).toEqual({ status: 'SUCCESS', data: dataA });
  });

  it('always dispatches LOAD before any RESOLVE or REJECT', async () => {
    const t = setup();
    t.load();
    t.calls[0].resolve(dataA);
    await flush();
    expect(t.dispatch.mock.calls.map(([e]) => e.type)).toEqual(['LOAD', 'RESOLVE']);
  });

  it('8. two loaders do not share request ids', async () => {
    const one = setup();
    const two = setup();
    one.load();
    two.load();
    two.load();
    one.calls[0].resolve(dataA);
    await flush();
    expect(one.view.state).toEqual({ status: 'SUCCESS', data: dataA });
  });
});
