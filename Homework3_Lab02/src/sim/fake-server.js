// @ts-check

const defaultSleep = (/** @type {number} */ ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Máy chủ giả: giờ máy chủ = giờ máy + skewMs, mỗi lần gọi mất `latencyMs` khứ hồi.
 * Giờ được lấy ở giữa chuyến đi (nửa đi, lấy mẫu, nửa về) để khớp giả định của server-clock.
 * @param {{ skewMs?: number, latencyMs?: number, wall?: () => number, sleep?: (ms: number) => Promise<void> }} [options]
 */
export function createFakeServer({ skewMs = 0, latencyMs = 0, wall = () => Date.now(), sleep = defaultSleep } = {}) {
  const leg = latencyMs / 2;

  async function serverNow() {
    await sleep(leg);
    const time = wall() + skewMs;
    await sleep(leg);
    return time;
  }

  /** Một chiều độ trễ mạng, dùng làm `delay` của inventory store. */
  async function delay() {
    await sleep(leg);
  }

  return { serverNow, delay };
}
