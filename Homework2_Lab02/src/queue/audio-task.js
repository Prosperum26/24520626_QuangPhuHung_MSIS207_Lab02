// @ts-check

// ---------- Contract (A1) ----------

/** @typedef {'queued' | 'loading' | 'decoding' | 'ready' | 'cancelled' | 'error'} TaskStatus */

/**
 * `id` tăng dần trong một queue. `status` đổi qua queue, không ai khác sửa.
 * `controller` là cancellation token của riêng tác vụ này.
 * @typedef {object} AudioTask
 * @property {number} id
 * @property {string} trackUrl
 * @property {TaskStatus} status
 * @property {AbortController} controller
 * @property {(buffer: AudioBuffer) => void} resolve
 * @property {(reason: unknown) => void} reject
 */

/**
 * Bản chỉ đọc gửi cho `subscribe`: UI không được chạm `controller`, `resolve`, `reject`.
 * @typedef {{ readonly id: number, readonly trackUrl: string, readonly status: TaskStatus }} TaskSnapshot
 */

/**
 * Hàm tải được inject vào queue. Phải gọi `onPhase('decoding')` khi bắt đầu giải mã
 * và phải reject bằng lỗi AbortError khi `signal` bị hủy.
 * @typedef {(
 *   trackUrl: string,
 *   options: { signal: AbortSignal, onPhase: (phase: 'decoding') => void },
 * ) => Promise<AudioBuffer>} LoadTrack
 */

/** @typedef {{ id: number, promise: Promise<AudioBuffer> }} EnqueueHandle */

// ---------- Hằng (mỗi quyết định ở một chỗ) ----------

export const TASK_STATUS = Object.freeze({
  QUEUED: 'queued',
  LOADING: 'loading',
  DECODING: 'decoding',
  READY: 'ready',
  CANCELLED: 'cancelled',
  ERROR: 'error',
});

const TERMINAL_STATUSES = new Set([TASK_STATUS.READY, TASK_STATUS.CANCELLED, TASK_STATUS.ERROR]);

/**
 * Trạng thái kết thúc không đổi nữa (bất biến 3 của queue).
 * @param {TaskStatus} status
 */
export function isTerminal(status) {
  return TERMINAL_STATUSES.has(status);
}

// ---------- Lỗi hủy ----------

/** Lỗi hủy duy nhất của bài, cùng `name` với lỗi `fetch` ném khi bị abort. */
export function createAbortError() {
  return new DOMException('The task was aborted', 'AbortError');
}

/**
 * Kiểm theo `name` (không theo `instanceof`) vì `fetch` và `DOMException` có thể đến từ realm khác.
 * @param {unknown} error
 */
export function isAbortError(error) {
  return typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError';
}
