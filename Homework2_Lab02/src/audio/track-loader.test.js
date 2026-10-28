import { describe, expect, it, vi } from 'vitest';
import { isAbortError } from '../queue/audio-task.js';
import { createTrackLoader } from './track-loader.js';

/** Cổng để test tự quyết lúc nào một bước bất đồng bộ xong. */
function gate() {
  let resolve;
  const promise = new Promise((res) => { resolve = res; });
  return { promise, resolve };
}

const settle = (promise) => promise.then(
  (value) => ({ ok: true, value }),
  (error) => ({ ok: false, error }),
);

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** fetch, arrayBuffer và decodeAudioData giả; `log` ghi thứ tự gọi. */
function setup() {
  const gates = { fetch: gate(), body: gate(), decode: gate() };
  const log = [];

  const fetchImpl = vi.fn((url, { signal }) => {
    log.push('fetch');
    return new Promise((resolve, reject) => {
      // fetch thật reject bằng signal.reason khi bị abort.
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      gates.fetch.promise.then(resolve);
    });
  });
  const decodeAudioData = vi.fn(() => {
    log.push('decode');
    return gates.decode.promise;
  });

  const loader = createTrackLoader({ audioContext: { decodeAudioData }, fetchImpl });
  const controller = new AbortController();
  const onPhase = vi.fn((phase) => log.push(`phase:${phase}`));
  const run = () => loader('track.mp3', { signal: controller.signal, onPhase });

  const okResponse = () => ({ ok: true, status: 200, arrayBuffer: () => gates.body.promise });
  return { gates, log, fetchImpl, decodeAudioData, controller, onPhase, run, okResponse };
}

describe('C1 track loader', () => {
  it('fetches, reports the decoding phase, then decodes and returns the buffer', async () => {
    const t = setup();
    const result = t.run();
    t.gates.fetch.resolve(t.okResponse());
    const bytes = new ArrayBuffer(8);
    t.gates.body.resolve(bytes);
    await flush();

    expect(t.log).toEqual(['fetch', 'phase:decoding', 'decode']);
    expect(t.decodeAudioData).toHaveBeenCalledWith(bytes);

    const audioBuffer = { duration: 3 };
    t.gates.decode.resolve(audioBuffer);
    expect(await result).toBe(audioBuffer);
    expect(t.onPhase).toHaveBeenCalledTimes(1);
  });

  it('passes the url and the very same signal to fetch', async () => {
    const t = setup();
    const result = t.run();
    t.controller.abort();
    await settle(result);
    expect(t.fetchImpl).toHaveBeenCalledWith('track.mp3', { signal: t.controller.signal });
  });

  it('rejects with AbortError when aborted while fetching, and never decodes', async () => {
    const t = setup();
    const result = t.run();
    await flush();
    t.controller.abort();
    const outcome = await settle(result);
    expect(isAbortError(outcome.error)).toBe(true);
    expect(t.decodeAudioData).not.toHaveBeenCalled();
    expect(t.onPhase).not.toHaveBeenCalled();
  });

  it('does not read the body when the response arrives after the abort', async () => {
    const t = setup();
    const arrayBuffer = vi.fn();
    // fetch "đến muộn": bỏ qua signal và vẫn trả về phản hồi bình thường.
    t.fetchImpl.mockImplementationOnce(() => Promise.resolve({ ok: true, status: 200, arrayBuffer }));
    const result = t.run();
    t.controller.abort();

    const outcome = await settle(result);
    expect(isAbortError(outcome.error)).toBe(true);
    expect(arrayBuffer).not.toHaveBeenCalled();
    expect(t.decodeAudioData).not.toHaveBeenCalled();
  });

  it('stops before decoding when aborted while the body is being read', async () => {
    const t = setup();
    const result = t.run();
    t.gates.fetch.resolve(t.okResponse());
    await flush();
    t.controller.abort();
    t.gates.body.resolve(new ArrayBuffer(8));

    const outcome = await settle(result);
    expect(isAbortError(outcome.error)).toBe(true);
    expect(t.decodeAudioData).not.toHaveBeenCalled();
    expect(t.onPhase).not.toHaveBeenCalled();
  });

  it('throws away the decoded buffer when aborted during decoding', async () => {
    const t = setup();
    const result = t.run();
    t.gates.fetch.resolve(t.okResponse());
    t.gates.body.resolve(new ArrayBuffer(8));
    await flush();
    expect(t.decodeAudioData).toHaveBeenCalledTimes(1);

    t.controller.abort();
    t.gates.decode.resolve({ duration: 3 });
    const outcome = await settle(result);
    expect(outcome.ok).toBe(false);
    expect(isAbortError(outcome.error)).toBe(true);
  });

  it('rejects an HTTP error with an ordinary error and does not read the body', async () => {
    const t = setup();
    const arrayBuffer = vi.fn();
    const result = t.run();
    t.gates.fetch.resolve({ ok: false, status: 404, arrayBuffer });
    const outcome = await settle(result);

    expect(outcome.ok).toBe(false);
    expect(isAbortError(outcome.error)).toBe(false);
    expect(outcome.error.message).toContain('404');
    expect(arrayBuffer).not.toHaveBeenCalled();
    expect(t.decodeAudioData).not.toHaveBeenCalled();
  });

  it('passes a decode failure through unchanged', async () => {
    const t = setup();
    const failure = new Error('Unable to decode audio data');
    t.decodeAudioData.mockImplementationOnce(() => Promise.reject(failure));

    const result = t.run();
    t.gates.fetch.resolve(t.okResponse());
    t.gates.body.resolve(new ArrayBuffer(8));
    expect((await settle(result)).error).toBe(failure);
  });
});
