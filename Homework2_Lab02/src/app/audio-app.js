// @ts-check
import { TASK_STATUS, isAbortError, isTerminal } from '../queue/audio-task.js';

/** @typedef {import('../queue/audio-task.js').TaskSnapshot} TaskSnapshot */
/** @typedef {import('../queue/audio-task.js').TaskStatus} TaskStatus */

/**
 * @typedef {object} Track
 * @property {number} id
 * @property {string} name
 * @property {string | null} objectUrl null sau khi đã thu hồi
 * @property {TaskStatus} status
 * @property {AudioBuffer | null} buffer
 * @property {string | null} errorMessage
 */

const STATUS_LABEL = Object.freeze({
  [TASK_STATUS.QUEUED]: 'Queued',
  [TASK_STATUS.LOADING]: 'Loading',
  [TASK_STATUS.DECODING]: 'Decoding',
  [TASK_STATUS.READY]: 'Ready',
  [TASK_STATUS.CANCELLED]: 'Cancelled',
  [TASK_STATUS.ERROR]: 'Error',
});

/** @param {number} seconds */
export function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const whole = Math.floor(seconds);
  const secondsPart = String(whole % 60).padStart(2, '0');
  return `${Math.floor(whole / 60)}:${secondsPart}`;
}

/** @param {unknown} error */
const messageOf = (error) => (error instanceof Error || (typeof error === 'object' && error !== null && 'message' in error)
  ? String(/** @type {{ message: unknown }} */ (error).message)
  : String(error));

/**
 * Nối queue, player, visualizer và DOM. Không có framework: mọi thứ vẽ bằng DOM API,
 * mọi sự kiện đi qua MỘT hàm `dispatch` đăng ký cho click, change và input ở gốc.
 *
 * `getEngine` tạo AudioContext, queue, player ở lần gọi đầu; app chỉ gọi nó từ handler của
 * người dùng (thêm file hoặc Play) để trình duyệt không chặn và không cảnh báo autoplay.
 *
 * @param {object} deps
 * @param {HTMLElement} deps.root
 * @param {() => { queue: import('../queue/audio-task-queue.js').AudioTaskQueue, player: ReturnType<typeof import('../audio/audio-player.js').createPlayer> }} deps.getEngine
 * @param {{ clear: () => void }} deps.visualizer
 * @param {{ effectEnabled: boolean, sync: () => void, setEffectEnabled: (enabled: boolean) => void }} deps.motion
 * @param {{ create: (file: File) => string, revoke: (url: string) => void }} deps.urls
 */
export function createAudioApp({ root, getEngine, visualizer, motion, urls }) {
  const doc = root.ownerDocument;

  /** @param {string} selector */
  function required(selector) {
    const element = root.querySelector(selector);
    if (element === null) throw new Error(`Missing ${selector} in the page`);
    return /** @type {HTMLElement} */ (element);
  }

  const fileInput = /** @type {HTMLInputElement} */ (required('#file-input'));
  const volumeInput = /** @type {HTMLInputElement} */ (required('#volume'));
  const volumeValue = required('#volume-value');
  const queueList = required('#queue-list');
  const readyList = required('#ready-list');
  const nowPlaying = required('#now-playing');
  const statusLine = required('#status');
  const effectButton = required('[data-action="toggle-effect"]');

  /** Theo thứ tự id tăng dần vì Map giữ thứ tự chèn và queue phát id tăng dần. @type {Map<number, Track>} */
  const tracks = new Map();
  /** @type {Map<string, string>} object URL -> tên file */
  const namesByUrl = new Map();
  /** @type {ReturnType<typeof getEngine> | null} */
  let engine = null;
  /** @type {number | null} */
  let playingId = null;

  // ---------- DOM ----------

  /**
   * @param {string} tag
   * @param {Record<string, string>} attributes
   * @param {...(string | Node)} children strings thành text node nên luôn an toàn trước XSS
   */
  function h(tag, attributes, ...children) {
    const element = doc.createElement(tag);
    for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
    element.append(...children);
    return element;
  }

  /**
   * @param {string} action
   * @param {Track} track
   * @param {string} label
   */
  function rowButton(action, track, label) {
    return h('button', {
      type: 'button',
      'data-action': action,
      'data-track-id': String(track.id),
      // Tên truy cập bắt đầu bằng chữ nhìn thấy (WCAG 2.5.3) và nói rõ bản nhạc nào.
      'aria-label': `${label} ${track.name}`,
    }, label);
  }

  /** @param {Track} track */
  function queueRow(track) {
    const detail = track.status === TASK_STATUS.ERROR
      ? `Status: Error. ${track.errorMessage ?? 'Unknown error'}`
      : `Status: ${STATUS_LABEL[track.status]}`;
    const action = isTerminal(track.status) ? rowButton('dismiss', track, 'Dismiss') : rowButton('cancel', track, 'Cancel');
    return h('li', { 'data-track-id': String(track.id) },
      h('span', { class: 'track-name' }, track.name),
      h('span', { class: 'track-status' }, detail),
      action);
  }

  /** @param {Track} track */
  function readyRow(track) {
    const isPlaying = track.id === playingId;
    return h('li', { 'data-track-id': String(track.id) },
      h('span', { class: 'track-name' }, track.name),
      h('span', { class: 'track-status' }, `Length ${formatDuration(track.buffer ? track.buffer.duration : 0)}${isPlaying ? '. Playing' : ''}`),
      rowButton('play', track, 'Play'),
      rowButton('remove', track, 'Remove'));
  }

  /** @param {HTMLElement} list @param {HTMLElement[]} rows @param {string} emptyText */
  function fill(list, rows, emptyText) {
    list.replaceChildren(...(rows.length > 0 ? rows : [h('li', { class: 'empty' }, emptyText)]));
  }

  /**
   * Render lại làm mất nút đang focus; trả focus về nút tương ứng, rồi về dòng, rồi về tiêu đề
   * của vùng (WCAG 2.4.3), thay vì để focus rơi về đầu trang.
   */
  function render() {
    const active = /** @type {HTMLElement | null} */ (doc.activeElement);
    const saved = active !== null && root.contains(active)
      ? {
        action: active.dataset.action ?? null,
        trackId: active.closest('li')?.getAttribute('data-track-id') ?? null,
        headingId: active.closest('section')?.querySelector('h2')?.id ?? null,
        inLists: queueList.contains(active) || readyList.contains(active),
      }
      : null;

    const all = [...tracks.values()];
    fill(queueList, all.filter((t) => t.status !== TASK_STATUS.READY).map(queueRow), 'No tracks waiting.');
    fill(readyList, all.filter((t) => t.status === TASK_STATUS.READY && t.buffer !== null).map(readyRow), 'No tracks ready yet.');
    nowPlaying.textContent = playingId === null
      ? 'Nothing is playing.'
      : `Now playing: ${tracks.get(playingId)?.name ?? ''}`;
    effectButton.setAttribute('aria-pressed', String(motion.effectEnabled));

    if (saved !== null && saved.inLists) restoreFocus(saved);
  }

  /** @param {{ action: string | null, trackId: string | null, headingId: string | null }} saved */
  function restoreFocus({ action, trackId, headingId }) {
    /** @type {Element | null} */
    let target = null;
    if (action !== null && trackId !== null) {
      target = root.querySelector(`[data-action="${action}"][data-track-id="${trackId}"]`)
        ?? root.querySelector(`li[data-track-id="${trackId}"] button`);
    }
    if (target === null && headingId) target = doc.getElementById(headingId);
    if (target instanceof doc.defaultView.HTMLElement) target.focus();
  }

  /** Chỉ gọi từ handler, không gọi lúc render (WCAG 4.1.3). @param {string} message */
  function announce(message) {
    statusLine.textContent = message;
  }

  // ---------- Vòng đời track ----------

  function ensureEngine() {
    if (engine === null) {
      engine = getEngine();
      engine.queue.subscribe(onTaskChange);
    }
    return engine;
  }

  /** @param {Track} track */
  function revokeUrl(track) {
    if (track.objectUrl === null) return;
    urls.revoke(track.objectUrl);
    namesByUrl.delete(track.objectUrl);
    track.objectUrl = null;
  }

  /** Mọi thay đổi trạng thái của queue đi qua đây, kể cả hủy từ bất kỳ nơi nào. @param {TaskSnapshot} snapshot */
  function onTaskChange(snapshot) {
    let track = tracks.get(snapshot.id);
    if (track === undefined) {
      // Lần đầu thấy tác vụ này: queue phát 'queued' và 'loading' đồng bộ ngay trong enqueue(),
      // trước khi enqueue() kịp trả id, nên track được tạo tại đây từ object URL.
      track = {
        id: snapshot.id,
        name: namesByUrl.get(snapshot.trackUrl) ?? snapshot.trackUrl,
        objectUrl: snapshot.trackUrl,
        status: snapshot.status,
        buffer: null,
        errorMessage: null,
      };
      tracks.set(snapshot.id, track);
    }
    track.status = snapshot.status;
    if (isTerminal(snapshot.status)) revokeUrl(track);

    if (snapshot.status === TASK_STATUS.LOADING) announce(`Loading ${track.name}`);
    if (snapshot.status === TASK_STATUS.CANCELLED) announce(`${track.name} cancelled`);
    render();
  }

  /** @param {number} id @param {AudioBuffer} buffer */
  function onLoaded(id, buffer) {
    const track = tracks.get(id);
    if (track === undefined) return;
    track.buffer = buffer;
    announce(`${track.name} is ready`);
    render();
  }

  /** @param {number} id @param {unknown} error */
  function onFailed(id, error) {
    // Hủy đã được onTaskChange xử lý; ở đây chỉ báo lỗi thật.
    if (isAbortError(error)) return;
    const track = tracks.get(id);
    if (track === undefined) return;
    track.errorMessage = messageOf(error);
    announce(`Could not load ${track.name}: ${track.errorMessage}`);
    render();
  }

  // ---------- Hành động (mỗi hành động một hàm) ----------

  function addFiles() {
    const files = Array.from(fileInput.files ?? []);
    if (files.length === 0) return;
    const { queue } = ensureEngine();

    for (const file of files) {
      const url = urls.create(file);
      namesByUrl.set(url, file.name);
      const { id, promise } = queue.enqueue(url);
      promise.then((buffer) => onLoaded(id, buffer), (error) => onFailed(id, error));
    }
    fileInput.value = '';
    announce(`Added ${files.length} ${files.length === 1 ? 'track' : 'tracks'} to the queue.`);
  }

  /** @param {number} id */
  function cancelTrack(id) {
    const cancelled = engine !== null && engine.queue.cancel(id);
    if (!cancelled) announce('That track has already finished.');
  }

  function cancelAll() {
    const count = engine === null ? 0 : engine.queue.cancelAll();
    announce(count === 0 ? 'Nothing to cancel.' : `Cancelled ${count} ${count === 1 ? 'track' : 'tracks'}.`);
  }

  /** @param {number} id */
  function dismissTrack(id) {
    const track = tracks.get(id);
    if (track === undefined || !isTerminal(track.status)) return;
    tracks.delete(id);
    render();
  }

  /** @param {number} id */
  async function playTrack(id) {
    const track = tracks.get(id);
    if (track === undefined || track.buffer === null) return;
    const { player } = ensureEngine();
    player.setVolume(Number(volumeInput.value) / 100);
    try {
      await player.play(track.buffer, { onEnded: () => onEnded(id) });
    } catch (error) {
      announce(`Could not play ${track.name}: ${messageOf(error)}`);
      return;
    }
    playingId = id;
    render();
    motion.sync();
    announce(`Playing ${track.name}`);
  }

  /** @param {number} id */
  function onEnded(id) {
    if (playingId !== id) return;
    const name = tracks.get(id)?.name ?? '';
    goIdle();
    announce(`Finished ${name}`);
  }

  function goIdle() {
    playingId = null;
    visualizer.clear();
    motion.sync();
    render();
  }

  function stopPlayback() {
    if (playingId === null || engine === null) {
      announce('Nothing is playing.');
      return;
    }
    const name = tracks.get(playingId)?.name ?? '';
    engine.player.stop();
    goIdle();
    announce(`Stopped ${name}`);
  }

  /** @param {number} id */
  function removeTrack(id) {
    const track = tracks.get(id);
    if (track === undefined) return;
    if (playingId === id && engine !== null) {
      engine.player.stop();
      goIdle();
    }
    tracks.delete(id);
    render();
    announce(`Removed ${track.name}`);
  }

  function changeVolume() {
    const percent = Number(volumeInput.value);
    volumeInput.setAttribute('aria-valuetext', `${percent}%`);
    volumeValue.textContent = `${percent}%`;
    if (engine !== null) engine.player.setVolume(percent / 100);
  }

  function toggleEffect() {
    const enabled = !motion.effectEnabled;
    motion.setEffectEnabled(enabled);
    if (!enabled) visualizer.clear();
    render();
    announce(enabled ? 'Visual effect on' : 'Visual effect off');
  }

  // ---------- Hub sự kiện duy nhất ----------

  /** @type {Readonly<Record<string, Readonly<Record<string, (element: HTMLElement) => void>>>>} */
  const handlers = {
    click: {
      cancel: (el) => cancelTrack(Number(el.dataset.trackId)),
      'cancel-all': cancelAll,
      dismiss: (el) => dismissTrack(Number(el.dataset.trackId)),
      play: (el) => { void playTrack(Number(el.dataset.trackId)); },
      remove: (el) => removeTrack(Number(el.dataset.trackId)),
      stop: stopPlayback,
      'toggle-effect': toggleEffect,
    },
    change: { 'add-files': addFiles },
    input: { volume: changeVolume },
  };

  /** @param {Event} event */
  function dispatch(event) {
    const target = /** @type {Element | null} */ (event.target);
    const element = target?.closest?.('[data-action]');
    if (!element) return;
    const table = handlers[event.type];
    const action = /** @type {HTMLElement} */ (element).dataset.action ?? '';
    if (table !== undefined && Object.hasOwn(table, action)) table[action](/** @type {HTMLElement} */ (element));
  }

  for (const type of Object.keys(handlers)) root.addEventListener(type, dispatch);

  render();
  return { render };
}
