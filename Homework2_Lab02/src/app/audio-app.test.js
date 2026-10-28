import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createAbortError } from '../queue/audio-task.js';
import { AudioTaskQueue } from '../queue/audio-task-queue.js';
import { createAudioApp, formatDuration } from './audio-app.js';

// Vitest chạy từ gốc repo (như main.test.js của Homework 1).
const html = readFileSync('Homework2_Lab02/index.html', 'utf8');

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Dựng thân trang thật từ index.html (bỏ thẻ script) để test chạm đúng id và data-action của trang. */
function mountPage() {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  parsed.querySelectorAll('script').forEach((script) => script.remove());
  document.body.replaceChildren(...[...parsed.body.childNodes].map((node) => document.importNode(node, true)));
  return /** @type {HTMLElement} */ (document.querySelector('main'));
}

function setup({ effectEnabled = true } = {}) {
  const root = mountPage();

  const loads = [];
  const load = (url, { signal, onPhase }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(createAbortError()), { once: true });
    loads.push({ url, signal, onPhase, resolve, reject });
  });
  const queue = new AudioTaskQueue(load);

  const player = {
    onEnded: null,
    play: vi.fn(async (buffer, options) => { player.onEnded = options?.onEnded ?? null; }),
    stop: vi.fn(),
    setVolume: vi.fn(),
  };
  const visualizer = { clear: vi.fn() };
  const motion = {
    effectEnabled,
    sync: vi.fn(),
    setEffectEnabled: vi.fn((value) => { motion.effectEnabled = value; }),
  };
  const urls = { create: vi.fn((file) => `blob:${file.name}`), revoke: vi.fn() };
  const getEngine = vi.fn(() => ({ queue, player }));

  const app = createAudioApp({ root, getEngine, visualizer, motion, urls });

  const $ = (selector) => root.querySelector(selector);
  return {
    root, queue, player, visualizer, motion, urls, getEngine, loads, app, $,
    status: () => $('#status').textContent,
    nowPlaying: () => $('#now-playing').textContent,
    queueRows: () => [...root.querySelectorAll('#queue-list li')],
    readyRows: () => [...root.querySelectorAll('#ready-list li')],
    addFiles(...names) {
      const input = $('#file-input');
      Object.defineProperty(input, 'files', { configurable: true, value: names.map((name) => new File(['x'], name)) });
      input.dispatchEvent(new Event('change', { bubbles: true }));
    },
    button(rowSelector, action) {
      return root.querySelector(`${rowSelector} [data-action="${action}"]`);
    },
    /** Cho một tác vụ tải xong và đợi giao diện cập nhật. */
    async finish(index, buffer = { duration: 65 }) {
      loads[index].resolve(buffer);
      await flush();
    },
  };
}

describe('formatDuration', () => {
  it.each([
    [0, '0:00'],
    [59.4, '0:59'],
    [65, '1:05'],
    [600, '10:00'],
    [3600, '60:00'],
  ])('formats %s seconds as %s', (seconds, text) => {
    expect(formatDuration(seconds)).toBe(text);
  });

  it.each([NaN, -1, Infinity])('falls back for %s', (seconds) => {
    expect(formatDuration(seconds)).toBe('0:00');
  });
});

describe('E2 wiring', () => {
  it('does not create the audio engine until the first add or play', () => {
    const t = setup();
    expect(t.getEngine).not.toHaveBeenCalled();
    t.$('[data-action="stop"]').click();
    t.$('[data-action="cancel-all"]').click();
    expect(t.getEngine).not.toHaveBeenCalled();
    expect(t.status()).toBe('Nothing to cancel.');
  });

  it('says so when Stop is pressed with nothing playing', () => {
    const t = setup();
    t.$('[data-action="stop"]').click();
    expect(t.status()).toBe('Nothing is playing.');
    expect(t.player.stop).not.toHaveBeenCalled();
  });

  it('registers exactly one handler for each of click, change and input on the root', () => {
    const root = mountPage();
    const spy = vi.spyOn(root, 'addEventListener');
    createAudioApp({
      root,
      getEngine: () => { throw new Error('unused'); },
      visualizer: { clear() {} },
      motion: { effectEnabled: true, sync() {}, setEffectEnabled() {} },
      urls: { create: () => '', revoke() {} },
    });
    expect(spy.mock.calls.map((call) => call[0]).sort()).toEqual(['change', 'click', 'input']);
    expect(new Set(spy.mock.calls.map((call) => call[1])).size).toBe(1);
  });

  it('ignores clicks on things that are not actions', () => {
    const t = setup();
    expect(() => {
      t.$('h1').click();
      t.root.click();
    }).not.toThrow();
  });
});

describe('E2 adding tracks', () => {
  it('enqueues files in the order chosen and shows loading then queued', () => {
    const t = setup();
    t.addFiles('a.mp3', 'b.mp3');

    expect(t.urls.create.mock.calls.map((c) => c[0].name)).toEqual(['a.mp3', 'b.mp3']);
    expect(t.loads.map((l) => l.url)).toEqual(['blob:a.mp3']);

    const rows = t.queueRows();
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('a.mp3');
    expect(rows[0].textContent).toContain('Status: Loading');
    expect(rows[1].textContent).toContain('b.mp3');
    expect(rows[1].textContent).toContain('Status: Queued');
    expect(t.status()).toBe('Added 2 tracks to the queue.');
  });

  it('uses the singular for one file', () => {
    const t = setup();
    t.addFiles('a.mp3');
    expect(t.status()).toBe('Added 1 track to the queue.');
  });

  it('shows the decoding phase', () => {
    const t = setup();
    t.addFiles('a.mp3');
    t.loads[0].onPhase('decoding');
    expect(t.queueRows()[0].textContent).toContain('Status: Decoding');
  });

  it('shows a file name as plain text, never as markup', () => {
    const t = setup();
    t.addFiles('<img src=x onerror=alert(1)>.mp3');
    expect(t.root.querySelector('img')).toBeNull();
    expect(t.queueRows()[0].querySelector('.track-name').textContent).toBe('<img src=x onerror=alert(1)>.mp3');
  });

  it('does nothing when no file was chosen', () => {
    const t = setup();
    t.addFiles();
    expect(t.getEngine).not.toHaveBeenCalled();
  });
});

describe('E2 cancelling', () => {
  it('cancels a waiting track and revokes its object URL once', async () => {
    const t = setup();
    t.addFiles('a.mp3', 'b.mp3');
    t.button('#queue-list li:nth-child(2)', 'cancel').click();
    // Đợi cả microtask của promise bị reject: lỗi hủy không được ghi đè thông báo bằng "Could not load".
    await flush();

    expect(t.queueRows()[1].textContent).toContain('Status: Cancelled');
    expect(t.urls.revoke.mock.calls.map((c) => c[0])).toEqual(['blob:b.mp3']);
    expect(t.status()).toBe('b.mp3 cancelled');
  });

  it('cancels the loading track through its abort signal and revokes its URL', () => {
    const t = setup();
    t.addFiles('a.mp3');
    t.button('#queue-list li:nth-child(1)', 'cancel').click();

    expect(t.loads[0].signal.aborted).toBe(true);
    expect(t.queueRows()[0].textContent).toContain('Status: Cancelled');
    expect(t.urls.revoke).toHaveBeenCalledWith('blob:a.mp3');
  });

  it('cancel-all cancels every unfinished track and reports how many', () => {
    const t = setup();
    t.addFiles('a.mp3', 'b.mp3', 'c.mp3');
    t.$('[data-action="cancel-all"]').click();

    expect(t.queueRows().every((row) => row.textContent.includes('Status: Cancelled'))).toBe(true);
    expect(t.status()).toBe('Cancelled 3 tracks.');
    expect(t.urls.revoke).toHaveBeenCalledTimes(3);
  });

  it('ignores the late result of a cancelled track and never revokes twice', async () => {
    const t = setup();
    t.addFiles('a.mp3');
    t.button('#queue-list li:nth-child(1)', 'cancel').click();
    t.loads[0].resolve({ duration: 5 });
    await flush();

    expect(t.readyRows()[0].classList.contains('empty')).toBe(true);
    expect(t.urls.revoke).toHaveBeenCalledTimes(1);
  });
});

describe('E2 loading results', () => {
  it('moves a finished track to the ready list, with its length, and revokes its URL', async () => {
    const t = setup();
    t.addFiles('a.mp3');
    await t.finish(0, { duration: 65 });

    expect(t.queueRows()[0].classList.contains('empty')).toBe(true);
    expect(t.readyRows()).toHaveLength(1);
    expect(t.readyRows()[0].textContent).toContain('a.mp3');
    expect(t.readyRows()[0].textContent).toContain('1:05');
    expect(t.urls.revoke.mock.calls.map((c) => c[0])).toEqual(['blob:a.mp3']);
    expect(t.status()).toBe('a.mp3 is ready');
  });

  it('starts the next track only after the previous one finished', async () => {
    const t = setup();
    t.addFiles('a.mp3', 'b.mp3');
    expect(t.loads).toHaveLength(1);
    await t.finish(0);
    expect(t.loads.map((l) => l.url)).toEqual(['blob:a.mp3', 'blob:b.mp3']);
    expect(t.queueRows()[0].textContent).toContain('Status: Loading');
  });

  it('keeps a failed track visible with the reason, revokes its URL, and lets the user dismiss it', async () => {
    const t = setup();
    t.addFiles('a.mp3');
    t.loads[0].reject(new Error('HTTP 404 while loading a.mp3'));
    await flush();

    const row = t.queueRows()[0];
    expect(row.textContent).toContain('Status: Error. HTTP 404 while loading a.mp3');
    expect(t.status()).toBe('Could not load a.mp3: HTTP 404 while loading a.mp3');
    expect(t.urls.revoke).toHaveBeenCalledTimes(1);

    t.button('#queue-list li:nth-child(1)', 'dismiss').click();
    expect(t.queueRows()[0].classList.contains('empty')).toBe(true);
  });
});

describe('E2 playback', () => {
  async function withReadyTrack(options) {
    const t = setup(options);
    t.addFiles('a.mp3');
    const buffer = { duration: 65, id: 'A' };
    await t.finish(0, buffer);
    return { t, buffer };
  }

  it('plays the buffer at the slider volume and shows what is playing', async () => {
    const { t, buffer } = await withReadyTrack();
    t.button('#ready-list li:nth-child(1)', 'play').click();
    await flush();

    expect(t.player.setVolume).toHaveBeenCalledWith(1);
    expect(t.player.play).toHaveBeenCalledWith(buffer, expect.objectContaining({ onEnded: expect.any(Function) }));
    expect(t.nowPlaying()).toBe('Now playing: a.mp3');
    expect(t.status()).toBe('Playing a.mp3');
    expect(t.motion.sync).toHaveBeenCalled();
    expect(t.readyRows()[0].textContent).toContain('Playing');
  });

  it('goes back to idle, clears the canvas and re-syncs the effect when the track ends', async () => {
    const { t } = await withReadyTrack();
    t.button('#ready-list li:nth-child(1)', 'play').click();
    await flush();
    t.motion.sync.mockClear();

    t.player.onEnded();
    expect(t.nowPlaying()).toBe('Nothing is playing.');
    expect(t.visualizer.clear).toHaveBeenCalled();
    expect(t.motion.sync).toHaveBeenCalledTimes(1);
    expect(t.status()).toBe('Finished a.mp3');
  });

  it('Stop stops the player, clears the canvas and re-syncs the effect', async () => {
    const { t } = await withReadyTrack();
    t.button('#ready-list li:nth-child(1)', 'play').click();
    await flush();
    t.motion.sync.mockClear();

    t.$('[data-action="stop"]').click();
    expect(t.player.stop).toHaveBeenCalledTimes(1);
    expect(t.nowPlaying()).toBe('Nothing is playing.');
    expect(t.visualizer.clear).toHaveBeenCalled();
    expect(t.motion.sync).toHaveBeenCalledTimes(1);
    expect(t.status()).toBe('Stopped a.mp3');
  });

  it('removing the playing track stops it and drops the buffer', async () => {
    const { t } = await withReadyTrack();
    t.button('#ready-list li:nth-child(1)', 'play').click();
    await flush();
    t.button('#ready-list li:nth-child(1)', 'remove').click();

    expect(t.player.stop).toHaveBeenCalledTimes(1);
    expect(t.readyRows()[0].classList.contains('empty')).toBe(true);
    expect(t.nowPlaying()).toBe('Nothing is playing.');
  });

  it('ignores the late onEnded of a track that was replaced by another', async () => {
    const t = setup();
    t.addFiles('a.mp3', 'b.mp3');
    await t.finish(0);
    await t.finish(1);

    t.button('#ready-list li:nth-child(1)', 'play').click();
    await flush();
    const endedA = t.player.onEnded;
    t.button('#ready-list li:nth-child(2)', 'play').click();
    await flush();

    endedA();
    expect(t.nowPlaying()).toBe('Now playing: b.mp3');
  });

  it('reports a playback failure instead of pretending to play', async () => {
    const { t } = await withReadyTrack();
    t.player.play.mockRejectedValueOnce(new Error('context closed'));
    t.button('#ready-list li:nth-child(1)', 'play').click();
    await flush();

    expect(t.status()).toBe('Could not play a.mp3: context closed');
    expect(t.nowPlaying()).toBe('Nothing is playing.');
  });
});

describe('E2 volume and effect controls', () => {
  function moveSlider(t, value) {
    const slider = t.$('#volume');
    slider.value = String(value);
    slider.dispatchEvent(new Event('input', { bubbles: true }));
  }

  it('shows the value, and does not create the engine just for the slider', () => {
    const t = setup();
    moveSlider(t, 40);
    expect(t.$('#volume').getAttribute('aria-valuetext')).toBe('40%');
    expect(t.$('#volume-value').textContent).toBe('40%');
    expect(t.getEngine).not.toHaveBeenCalled();
  });

  it('applies the slider to the player once it exists, and at the first play', async () => {
    const t = setup();
    moveSlider(t, 40);
    t.addFiles('a.mp3');
    await t.finish(0);
    t.button('#ready-list li:nth-child(1)', 'play').click();
    await flush();
    expect(t.player.setVolume).toHaveBeenLastCalledWith(0.4);

    moveSlider(t, 25);
    expect(t.player.setVolume).toHaveBeenLastCalledWith(0.25);
  });

  it('toggles the visual effect, mirrors it in aria-pressed, and clears the canvas when turned off', () => {
    const t = setup();
    const button = t.$('[data-action="toggle-effect"]');
    expect(button.getAttribute('aria-pressed')).toBe('true');

    button.click();
    expect(t.motion.setEffectEnabled).toHaveBeenLastCalledWith(false);
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(t.visualizer.clear).toHaveBeenCalled();
    expect(t.status()).toBe('Visual effect off');

    t.visualizer.clear.mockClear();
    button.click();
    expect(t.motion.setEffectEnabled).toHaveBeenLastCalledWith(true);
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(t.visualizer.clear).not.toHaveBeenCalled();
  });

  it('starts with the button off when the policy starts with the effect off', () => {
    const t = setup({ effectEnabled: false });
    expect(t.$('[data-action="toggle-effect"]').getAttribute('aria-pressed')).toBe('false');
  });
});

describe('E2 accessibility', () => {
  it('names every row button with its visible text plus the track name', async () => {
    const t = setup();
    t.addFiles('a.mp3', 'b.mp3');
    await t.finish(0);
    const buttons = [...t.root.querySelectorAll('.track-list button')];
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      const label = button.getAttribute('aria-label');
      expect(label, button.outerHTML).toMatch(new RegExp(`^${button.textContent} `));
    }
  });

  it('moves focus to the same row when the focused button disappears (Cancel -> Dismiss)', () => {
    const t = setup();
    t.addFiles('a.mp3');
    const cancel = t.button('#queue-list li:nth-child(1)', 'cancel');
    cancel.focus();
    cancel.click();
    expect(document.activeElement).toBe(t.button('#queue-list li:nth-child(1)', 'dismiss'));
  });

  it('moves focus to the list heading when the whole row disappears (Dismiss)', async () => {
    const t = setup();
    t.addFiles('a.mp3');
    t.loads[0].reject(new Error('boom'));
    await flush();
    const dismiss = t.button('#queue-list li:nth-child(1)', 'dismiss');
    dismiss.focus();
    dismiss.click();
    expect(document.activeElement).toBe(t.$('#queue-heading'));
  });

  it('keeps focus on Play after it is pressed', async () => {
    const t = setup();
    t.addFiles('a.mp3');
    await t.finish(0);
    const play = t.button('#ready-list li:nth-child(1)', 'play');
    play.focus();
    play.click();
    await flush();
    expect(document.activeElement).toBe(t.button('#ready-list li:nth-child(1)', 'play'));
  });

  it('moves focus to the ready heading after a ready track is removed', async () => {
    const t = setup();
    t.addFiles('a.mp3');
    await t.finish(0);
    const remove = t.button('#ready-list li:nth-child(1)', 'remove');
    remove.focus();
    remove.click();
    expect(document.activeElement).toBe(t.$('#ready-heading'));
  });
});
