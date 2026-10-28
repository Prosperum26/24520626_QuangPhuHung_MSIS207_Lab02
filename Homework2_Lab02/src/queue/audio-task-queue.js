// @ts-check
import { TASK_STATUS, createAbortError, isTerminal } from './audio-task.js';

/** @typedef {import('./audio-task.js').AudioTask} AudioTask */
/** @typedef {import('./audio-task.js').TaskSnapshot} TaskSnapshot */
/** @typedef {import('./audio-task.js').LoadTrack} LoadTrack */
/** @typedef {import('./audio-task.js').EnqueueHandle} EnqueueHandle */

export class AudioTaskQueue {
  /** @type {LoadTrack} */
  #load;
  /** @type {AudioTask[]} */
  #queue = [];
  /** @type {AudioTask | null} */
  #active = null;
  #nextId = 1;
  /** @type {Set<(task: TaskSnapshot) => void>} */
  #listeners = new Set();

  /** @param {LoadTrack} load */
  constructor(load) {
    this.#load = load;
  }

  /**
   * @param {string} trackUrl
   * @returns {EnqueueHandle}
   */
  enqueue(trackUrl) {
    const id = this.#nextId;
    this.#nextId += 1;
    const promise = new Promise((resolve, reject) => {
      /** @type {AudioTask} */
      const task = {
        id, trackUrl, status: TASK_STATUS.QUEUED, controller: new AbortController(), resolve, reject,
      };
      this.#queue.push(task);
      this.#emit(task);
    });
    this.#processNext();
    return { id, promise };
  }

  /**
   * Hủy một tác vụ chưa kết thúc: đang chờ, đang tải hoặc đang giải mã.
   * @param {number} id
   * @returns {boolean} true nếu có hủy
   */
  cancel(id) {
    const waitingIndex = this.#queue.findIndex((task) => task.id === id);
    if (waitingIndex !== -1) {
      const [task] = this.#queue.splice(waitingIndex, 1);
      this.#abort(task);
      return true;
    }
    if (this.#active && this.#active.id === id && !isTerminal(this.#active.status)) {
      this.#abort(this.#active);
      return true;
    }
    return false;
  }

  /** @returns {number} số tác vụ đã hủy */
  cancelAll() {
    const everyUnfinished = this.#active ? [this.#active, ...this.#queue] : [...this.#queue];
    return everyUnfinished.filter((task) => this.cancel(task.id)).length;
  }

  /**
   * @param {(task: TaskSnapshot) => void} listener
   * @returns {() => void} hàm hủy đăng ký
   */
  subscribe(listener) {
    this.#listeners.add(listener);
    return () => { this.#listeners.delete(listener); };
  }

  // Chỗ DUY NHẤT quyết định lấy tác vụ nào và khi nào: muốn đổi FIFO thành song song thì sửa ở đây.
  async #processNext() {
    if (this.#active) return;
    const task = this.#queue.shift();
    if (!task) return;

    this.#active = task;
    this.#setStatus(task, TASK_STATUS.LOADING);
    try {
      const buffer = await this.#load(task.trackUrl, {
        signal: task.controller.signal,
        onPhase: () => {
          if (task.status === TASK_STATUS.LOADING) this.#setStatus(task, TASK_STATUS.DECODING);
        },
      });
      // Đã bị hủy trong lúc `load` chạy (decodeAudioData không hủy được): bỏ kết quả.
      if (!isTerminal(task.status)) {
        this.#setStatus(task, TASK_STATUS.READY);
        task.resolve(buffer);
      }
    } catch (error) {
      // Tác vụ đã `cancelled` thì giữ nguyên, kể cả khi `load` ném lỗi khác lúc bị abort.
      if (!isTerminal(task.status)) {
        this.#setStatus(task, TASK_STATUS.ERROR);
        task.reject(error);
      }
    } finally {
      // Chỉ nhả `#active` sau khi `load` đã settle để không bao giờ có hai load chạy chồng nhau.
      this.#active = null;
      this.#processNext();
    }
  }

  /**
   * Trạng thái và promise đổi ngay (UI phản hồi tức thì), còn `#active` do `#processNext` nhả.
   * @param {AudioTask} task
   */
  #abort(task) {
    task.controller.abort();
    this.#setStatus(task, TASK_STATUS.CANCELLED);
    task.reject(createAbortError());
  }

  /**
   * @param {AudioTask} task
   * @param {import('./audio-task.js').TaskStatus} status
   */
  #setStatus(task, status) {
    task.status = status;
    this.#emit(task);
  }

  /** @param {AudioTask} task */
  #emit(task) {
    const snapshot = Object.freeze({ id: task.id, trackUrl: task.trackUrl, status: task.status });
    for (const listener of this.#listeners) {
      try {
        listener(snapshot);
      } catch (error) {
        // Lỗi của listener không được làm hỏng hàng đợi, nhưng cũng không được nuốt im lặng.
        console.error('AudioTaskQueue listener threw', error);
      }
    }
  }
}
