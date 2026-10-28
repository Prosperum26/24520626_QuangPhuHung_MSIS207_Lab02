import { describe, expect, it, vi } from 'vitest';
import { createAbortError, isAbortError } from './audio-task.js';
import { AudioTaskQueue } from './audio-task-queue.js';

/** Cho các microtask đang chờ chạy hết. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Biến Promise thành giá trị (kể cả khi reject) để test không dính unhandled rejection. */
const settle = (promise) => promise.then(
  (value) => ({ ok: true, value }),
  (error) => ({ ok: false, error }),
);

/**
 * `load` giả: mỗi lần gọi ghi lại một `call` để test tự quyết lúc nào xong.
 * `respectSignal` mô phỏng loader tử tế (reject khi bị abort); false mô phỏng
 * `decodeAudioData` không hủy được.
 */
function createFakeLoader({ respectSignal = true } = {}) {
  const calls = [];
  let active = 0;
  let maxActive = 0;

  const load = (url, { signal, onPhase }) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    return new Promise((resolve, reject) => {
      const finish = (fn) => (value) => { active -= 1; fn(value); };
      const call = { url, signal, onPhase, resolve: finish(resolve), reject: finish(reject) };
      if (respectSignal) {
        signal.addEventListener('abort', () => call.reject(createAbortError()), { once: true });
      }
      calls.push(call);
    });
  };

  return { load, calls, get maxActive() { return maxActive; } };
}

const buffer = (name) => /** @type {any} */ ({ name });

function setup(options) {
  const loader = createFakeLoader(options);
  const queue = new AudioTaskQueue(loader.load);
  // Trong ứng dụng, nơi gọi enqueue tự bắt lỗi hủy. Ở test, đánh dấu "đã xử lý" ngay để các
  // test hủy rồi mới await không bị báo unhandled rejection; promise trả về vẫn nguyên.
  const enqueue = queue.enqueue.bind(queue);
  queue.enqueue = (trackUrl) => {
    const handle = enqueue(trackUrl);
    handle.promise.catch(() => {});
    return handle;
  };
  const events = [];
  queue.subscribe((task) => events.push(`${task.id}:${task.status}`));
  return { loader, queue, events };
}

describe('B1 sequential FIFO', () => {
  it('starts the first track immediately and the others only after it finishes', async () => {
    const { loader, queue } = setup();
    queue.enqueue('a.mp3');
    queue.enqueue('b.mp3');
    queue.enqueue('c.mp3');
    await flush();
    expect(loader.calls.map((c) => c.url)).toEqual(['a.mp3']);

    loader.calls[0].resolve(buffer('A'));
    await flush();
    expect(loader.calls.map((c) => c.url)).toEqual(['a.mp3', 'b.mp3']);

    loader.calls[1].resolve(buffer('B'));
    await flush();
    expect(loader.calls.map((c) => c.url)).toEqual(['a.mp3', 'b.mp3', 'c.mp3']);
  });

  it('resolves each promise with its own buffer', async () => {
    const { loader, queue } = setup();
    const a = queue.enqueue('a.mp3');
    const b = queue.enqueue('b.mp3');
    loader.calls[0].resolve(buffer('A'));
    await flush();
    loader.calls[1].resolve(buffer('B'));
    expect(await a.promise).toEqual({ name: 'A' });
    expect(await b.promise).toEqual({ name: 'B' });
  });

  it('never runs two loads at the same time', async () => {
    const { loader, queue } = setup();
    for (const name of ['a', 'b', 'c', 'd']) queue.enqueue(`${name}.mp3`);
    for (let i = 0; i < 4; i += 1) {
      await flush();
      loader.calls[i].resolve(buffer(String(i)));
    }
    await flush();
    expect(loader.calls).toHaveLength(4);
    expect(loader.maxActive).toBe(1);
  });

  it('gives unique ascending ids', () => {
    const { queue } = setup();
    const ids = [queue.enqueue('a'), queue.enqueue('b'), queue.enqueue('c')].map((h) => h.id);
    expect(ids).toEqual([1, 2, 3]);
  });
});

describe('B2 status changes and subscribe', () => {
  it('walks queued, loading, decoding, ready for one track', async () => {
    const { loader, queue, events } = setup();
    queue.enqueue('a.mp3');
    await flush();
    loader.calls[0].onPhase('decoding');
    loader.calls[0].resolve(buffer('A'));
    await flush();
    expect(events).toEqual(['1:queued', '1:loading', '1:decoding', '1:ready']);
  });

  it('keeps a waiting track queued until the previous one finishes', async () => {
    const { loader, queue, events } = setup();
    queue.enqueue('a.mp3');
    queue.enqueue('b.mp3');
    await flush();
    expect(events).toEqual(['1:queued', '1:loading', '2:queued']);
    loader.calls[0].resolve(buffer('A'));
    await flush();
    expect(events).toEqual(['1:queued', '1:loading', '2:queued', '1:ready', '2:loading']);
  });

  it('ignores onPhase once the task is no longer loading', async () => {
    const { loader, queue, events } = setup();
    queue.enqueue('a.mp3');
    await flush();
    loader.calls[0].onPhase('decoding');
    loader.calls[0].onPhase('decoding');
    expect(events.filter((e) => e === '1:decoding')).toHaveLength(1);
  });

  it('hands listeners a frozen snapshot, not the internal task', async () => {
    const { queue } = setup();
    const seen = [];
    queue.subscribe((task) => seen.push(task));
    queue.enqueue('a.mp3');
    expect(Object.isFrozen(seen[0])).toBe(true);
    expect(Object.keys(seen[0]).sort()).toEqual(['id', 'status', 'trackUrl']);
  });

  it('stops notifying after unsubscribe', async () => {
    const loader = createFakeLoader();
    const queue = new AudioTaskQueue(loader.load);
    const listener = vi.fn();
    const unsubscribe = queue.subscribe(listener);
    queue.enqueue('a.mp3');
    const callsBefore = listener.mock.calls.length;
    unsubscribe();
    loader.calls[0].resolve(buffer('A'));
    await flush();
    expect(listener.mock.calls).toHaveLength(callsBefore);
  });

  it('keeps working when a listener throws', async () => {
    const loader = createFakeLoader();
    const queue = new AudioTaskQueue(loader.load);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    queue.subscribe(() => { throw new Error('listener bug'); });
    const a = queue.enqueue('a.mp3');
    loader.calls[0].resolve(buffer('A'));
    expect(await a.promise).toEqual({ name: 'A' });
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

describe('B3 cancel a waiting task', () => {
  it('removes it from the line and rejects with AbortError', async () => {
    const { loader, queue, events } = setup();
    queue.enqueue('a.mp3');
    const b = queue.enqueue('b.mp3');
    queue.enqueue('c.mp3');
    await flush();

    expect(queue.cancel(b.id)).toBe(true);
    const result = await settle(b.promise);
    expect(result.ok).toBe(false);
    expect(isAbortError(result.error)).toBe(true);
    expect(events).toContain('2:cancelled');

    loader.calls[0].resolve(buffer('A'));
    await flush();
    expect(loader.calls.map((c) => c.url)).toEqual(['a.mp3', 'c.mp3']);
  });

  it('returns false for an unknown id', () => {
    const { queue } = setup();
    expect(queue.cancel(999)).toBe(false);
  });

  it('cancelling twice rejects only once and the second call returns false', async () => {
    const { queue, events } = setup();
    queue.enqueue('a.mp3');
    const b = queue.enqueue('b.mp3');
    expect(queue.cancel(b.id)).toBe(true);
    expect(queue.cancel(b.id)).toBe(false);
    await settle(b.promise);
    expect(events.filter((e) => e === '2:cancelled')).toHaveLength(1);
  });
});

describe('B4 cancel a running task', () => {
  it.each([
    ['loading', false],
    ['decoding', true],
  ])('aborts the signal while %s and moves on to the next track', async (_phase, enterDecoding) => {
    const { loader, queue, events } = setup();
    const a = queue.enqueue('a.mp3');
    queue.enqueue('b.mp3');
    await flush();
    if (enterDecoding) loader.calls[0].onPhase('decoding');

    expect(queue.cancel(a.id)).toBe(true);
    expect(loader.calls[0].signal.aborted).toBe(true);
    const result = await settle(a.promise);
    expect(isAbortError(result.error)).toBe(true);
    expect(events).toContain('1:cancelled');

    await flush();
    expect(loader.calls.map((c) => c.url)).toEqual(['a.mp3', 'b.mp3']);
  });

  it('waits for an uncancellable load to settle before starting the next one', async () => {
    const { loader, queue, events } = setup({ respectSignal: false });
    const a = queue.enqueue('a.mp3');
    queue.enqueue('b.mp3');
    await flush();
    loader.calls[0].onPhase('decoding');

    queue.cancel(a.id);
    await flush();
    expect(events).toContain('1:cancelled');
    expect(loader.calls).toHaveLength(1);

    loader.calls[0].resolve(buffer('A'));
    await flush();
    expect(loader.calls.map((c) => c.url)).toEqual(['a.mp3', 'b.mp3']);
    expect(loader.maxActive).toBe(1);
  });

  it('drops the result of a cancelled task that finishes anyway', async () => {
    const { loader, queue, events } = setup({ respectSignal: false });
    const a = queue.enqueue('a.mp3');
    await flush();
    queue.cancel(a.id);
    loader.calls[0].resolve(buffer('A'));
    await flush();

    const result = await settle(a.promise);
    expect(result.ok).toBe(false);
    expect(isAbortError(result.error)).toBe(true);
    expect(events).not.toContain('1:ready');
  });

  it('stays cancelled when the aborted load rejects with some other error', async () => {
    const { loader, queue, events } = setup({ respectSignal: false });
    const a = queue.enqueue('a.mp3');
    await flush();
    queue.cancel(a.id);
    loader.calls[0].reject(new TypeError('network died'));
    await flush();

    expect(events).toContain('1:cancelled');
    expect(events).not.toContain('1:error');
    expect(isAbortError((await settle(a.promise)).error)).toBe(true);
  });

  it('cannot cancel a task that already finished', async () => {
    const { loader, queue } = setup();
    const a = queue.enqueue('a.mp3');
    await flush();
    loader.calls[0].resolve(buffer('A'));
    await a.promise;
    expect(queue.cancel(a.id)).toBe(false);
  });
});

describe('B5 errors do not block the line', () => {
  it('rejects with the original error, marks error, and runs the next track', async () => {
    const { loader, queue, events } = setup();
    const a = queue.enqueue('a.mp3');
    const b = queue.enqueue('b.mp3');
    await flush();

    const boom = new Error('HTTP 404');
    loader.calls[0].reject(boom);
    expect((await settle(a.promise)).error).toBe(boom);
    expect(events).toContain('1:error');

    await flush();
    loader.calls[1].resolve(buffer('B'));
    expect(await b.promise).toEqual({ name: 'B' });
  });

  it('does not start a second processing loop when enqueue is called mid-run', async () => {
    const { loader, queue } = setup();
    queue.enqueue('a.mp3');
    await flush();
    queue.enqueue('b.mp3');
    queue.enqueue('c.mp3');
    await flush();
    expect(loader.calls).toHaveLength(1);
    expect(loader.maxActive).toBe(1);
  });

  it('treats an AbortError that nobody asked for as a plain error', async () => {
    const { loader, queue, events } = setup();
    const a = queue.enqueue('a.mp3');
    await flush();
    loader.calls[0].reject(createAbortError());
    await settle(a.promise);
    expect(events).toContain('1:error');
  });
});

describe('B6 cancelAll', () => {
  it('cancels the running and the waiting tasks and returns how many', async () => {
    const { loader, queue } = setup();
    const handles = [queue.enqueue('a.mp3'), queue.enqueue('b.mp3'), queue.enqueue('c.mp3')];
    await flush();

    expect(queue.cancelAll()).toBe(3);
    const results = await Promise.all(handles.map((h) => settle(h.promise)));
    expect(results.every((r) => !r.ok && isAbortError(r.error))).toBe(true);

    await flush();
    expect(loader.calls.map((c) => c.url)).toEqual(['a.mp3']);
  });

  it('returns 0 and does nothing on an empty line', () => {
    const { queue } = setup();
    expect(queue.cancelAll()).toBe(0);
  });

  it('still accepts new tracks afterwards', async () => {
    const { loader, queue } = setup();
    const a = queue.enqueue('a.mp3');
    await flush();
    queue.cancelAll();
    await settle(a.promise);

    const d = queue.enqueue('d.mp3');
    await flush();
    expect(loader.calls.map((c) => c.url)).toEqual(['a.mp3', 'd.mp3']);
    loader.calls[1].resolve(buffer('D'));
    expect(await d.promise).toEqual({ name: 'D' });
  });
});
