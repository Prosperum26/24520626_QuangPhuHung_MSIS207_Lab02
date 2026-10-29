// @ts-check

/**
 * @typedef {Object} Milestone
 * @property {string} id
 * @property {number} atMs      còn lại <= atMs thì thông báo
 * @property {'status'|'alert'} level   status = lịch sự (role="status"); alert = khẩn cấp (role="alert")
 * @property {string} text
 */

/** @type {ReadonlyArray<Milestone>} */
export const HOLD_MILESTONES = Object.freeze([
  { id: 'm60', atMs: 60_000, level: 'status', text: 'Còn 1 phút để giữ hàng. Bạn có thể gia hạn.' },
  { id: 'm10', atMs: 10_000, level: 'alert', text: 'Chỉ còn 10 giây. Lượt giữ hàng sắp hết hạn.' },
  { id: 'm0', atMs: 0, level: 'alert', text: 'Đã hết thời gian giữ hàng. Hàng đã được trả về kho.' },
]);

/**
 * Mỗi mốc chỉ thông báo một lần cho mỗi lần đếm. Đồng hồ chạy theo khung hình nên không được
 * thông báo từng tick (WCAG 4.1.3), chỉ thông báo lúc đi qua mốc.
 * @param {ReadonlyArray<Milestone>} milestones
 */
export function createMilestoneTracker(milestones) {
  /** @type {Set<string>} */
  const fired = new Set();

  /**
   * Gọi khi bắt đầu hoặc gia hạn một lần đếm: các mốc đã ở phía sau thì coi như đã qua, không thông báo.
   * @param {number} remaining
   */
  function arm(remaining) {
    fired.clear();
    for (const m of milestones) if (m.atMs >= remaining) fired.add(m.id);
  }

  /**
   * Nếu nhảy qua nhiều mốc cùng lúc (tab ẩn rồi quay lại) chỉ trả mốc khẩn nhất, tránh đọc dồn.
   * @param {number} remaining
   * @returns {Milestone | null}
   */
  function check(remaining) {
    /** @type {Milestone | null} */
    let urgent = null;
    for (const m of milestones) {
      if (remaining <= m.atMs && !fired.has(m.id)) {
        fired.add(m.id);
        if (urgent === null || m.atMs < urgent.atMs) urgent = m;
      }
    }
    return urgent;
  }

  return { arm, check };
}
