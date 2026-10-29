// @ts-check

const pad = (/** @type {number} */ n, /** @type {number} */ width) => String(n).padStart(width, '0');

/**
 * Tách để giao diện ẩn phần mili giây riêng khi người dùng bật prefers-reduced-motion.
 * @param {number} ms
 * @returns {{ clock: string, millis: string }}
 */
export function splitRemaining(ms) {
  const total = Math.max(0, Math.floor(ms));
  const minutes = Math.floor(total / 60_000);
  const seconds = Math.floor((total % 60_000) / 1000);
  return { clock: `${pad(minutes, 2)}:${pad(seconds, 2)}`, millis: pad(total % 1000, 3) };
}

/** @param {number} ms @returns {string} dạng mm:ss.mmm */
export function formatRemaining(ms) {
  const { clock, millis } = splitRemaining(ms);
  return `${clock}.${millis}`;
}

/** Giá trị cho thuộc tính datetime của <time>, ví dụ PT1M30.500S. @param {number} ms */
export function toIsoDuration(ms) {
  const total = Math.max(0, Math.floor(ms));
  const minutes = Math.floor(total / 60_000);
  const seconds = Math.floor((total % 60_000) / 1000);
  return `PT${minutes}M${seconds}.${pad(total % 1000, 3)}S`;
}
