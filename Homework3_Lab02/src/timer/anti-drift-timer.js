// @ts-check
import { createCountdown } from './countdown.js';

/** @typedef {import('./countdown.js').TimerDeps} TimerDeps */

/**
 * Đếm ngược durationMs kể từ lúc gọi. Chỉ chốt mốc đích một lần, phần còn lại do createCountdown lo.
 * @param {number} durationMs
 * @param {(remaining: number) => void} onTick
 * @param {TimerDeps} [deps]
 * @returns {() => void}
 */
export function createAntiDriftTimer(durationMs, onTick, deps = {}) {
  const now = deps.now ?? (() => Date.now());
  return createCountdown(now() + durationMs, onTick, { ...deps, now });
}
