// @ts-check

/**
 * @typedef {Object} ServerClockDeps
 * @property {() => Promise<number>} serverNow   giờ máy chủ (ms); có thể có độ trễ mạng
 * @property {() => number} [mono]               đồng hồ đơn điệu, mặc định performance.now
 * @property {() => number} [wall]               giờ hệ thống, chỉ để tính offset, mặc định Date.now
 */

/**
 * Neo giờ máy chủ một lần lúc sync, sau đó chỉ cộng thời gian đơn điệu.
 * Vì sao: Date.now() nhảy khi NTP đồng bộ hoặc người dùng đổi giờ; performance.now() thì không.
 * @param {ServerClockDeps} deps
 */
export function createServerClock({ serverNow, mono = () => performance.now(), wall = () => Date.now() }) {
  /** @type {{ serverAnchor: number, monoAnchor: number, offset: number } | null} */
  let anchor = null;

  async function sync() {
    const sentAt = mono();
    const server = await serverNow();
    const receivedAt = mono();
    // Cristian: giả định đường đi và về bằng nhau, nên giờ máy chủ "lúc nhận" = server + nửa khứ hồi.
    const serverAnchor = server + (receivedAt - sentAt) / 2;
    anchor = { serverAnchor, monoAnchor: receivedAt, offset: serverAnchor - wall() };
  }

  /** @returns {{ serverAnchor: number, monoAnchor: number, offset: number }} */
  function requireAnchor() {
    if (anchor === null) throw new Error('Server clock chưa sync(): gọi sync() trước khi đọc now().');
    return anchor;
  }

  function now() {
    const a = requireAnchor();
    return a.serverAnchor + (mono() - a.monoAnchor);
  }

  function offset() {
    return requireAnchor().offset;
  }

  return { sync, now, offset };
}
