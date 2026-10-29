// @ts-check

/**
 * @typedef {Object} TimerDeps
 * @property {() => number} [now]                 mặc định Date.now
 * @property {(cb: () => void) => number} [raf]   mặc định requestAnimationFrame
 * @property {(id: number) => void} [caf]         mặc định cancelAnimationFrame
 */

/**
 * Đếm ngược tới một mốc tuyệt đối. Mỗi tick tính lại targetTime - now(), không cộng dồn,
 * nên frame trễ hay tab bị ẩn đều không làm lệch kết quả.
 * @param {number} targetTime
 * @param {(remaining: number) => void} onTick
 * @param {TimerDeps} [deps]
 * @returns {() => void} hàm hủy, gọi nhiều lần vẫn an toàn
 */
export function createCountdown(targetTime, onTick, deps = {}) {
  const now = deps.now ?? (() => Date.now());
  const raf = deps.raf ?? ((cb) => requestAnimationFrame(cb));
  const caf = deps.caf ?? ((id) => cancelAnimationFrame(id));

  let stopped = false;
  /** @type {number | undefined} */
  let rafId;

  function tick() {
    rafId = undefined;
    if (stopped) return;
    const remaining = Math.max(0, targetTime - now());
    if (remaining > 0) {
      // Lên lịch trước onTick để cancel() gọi từ trong onTick vẫn hủy được frame kế.
      rafId = raf(tick);
      onTick(remaining);
      return;
    }
    stopped = true;
    onTick(0);
  }

  rafId = raf(tick);

  return function cancel() {
    stopped = true;
    if (rafId !== undefined) {
      caf(rafId);
      rafId = undefined;
    }
  };
}
