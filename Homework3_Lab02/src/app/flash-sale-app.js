// @ts-check
import { available } from '../inventory/inventory-fsm.js';
import { commitWithRetry, reserveWithRetry } from '../inventory/reserve-with-retry.js';
import { MAX_EXTENSIONS } from '../inventory/types.js';
import { createCountdown } from '../timer/countdown.js';
import { simulateBuyers, simulateNaiveBuyers } from '../sim/buyers.js';
import { splitRemaining, toIsoDuration } from './format-time.js';
import { HOLD_MILESTONES, createMilestoneTracker } from './milestones.js';

/** @typedef {import('../inventory/types.js').Inventory} Inventory */
/** @typedef {import('../inventory/types.js').EventInput} EventInput */
/** @typedef {import('../inventory/reserve-with-retry.js').Store} Store */
/** @typedef {import('../timer/countdown.js').TimerDeps} TimerDeps */

const ME = 'you';
const EXPIRY_WAKE_SLACK_MS = 50;

const HOLD_STATUS_TEXT = {
  RESERVED: 'Đang giữ hàng',
  CHECKOUT: 'Đang thanh toán',
  SOLD: 'Đã mua',
  EXPIRED: 'Hết hạn giữ hàng',
  CANCELLED: 'Đã hủy',
};

const REASON_TEXT = {
  SALE_NOT_LIVE: 'Đợt sale chưa mở hoặc đã kết thúc.',
  SOLD_OUT: 'Rất tiếc, đã hết hàng.',
  NOT_FOUND: 'Không tìm thấy lượt giữ hàng.',
  INVALID_TRANSITION: 'Thao tác này không còn hợp lệ.',
  HOLD_EXPIRED: 'Lượt giữ hàng đã hết hạn.',
  EXTENSION_LIMIT: `Bạn chỉ được gia hạn tối đa ${MAX_EXTENSIONS} lần.`,
};

/**
 * Nối giao diện với clock, store và timer. Chỉ file này đụng DOM của trang.
 * Timer chỉ để hiển thị: hết hạn do store quyết định (lazy expiry), timer và setTimeout chỉ "đánh thức".
 * @param {{ root: HTMLElement, clock: { now: () => number, offset: () => number }, store: Store, timerDeps?: TimerDeps }} deps
 */
export async function mountFlashSale({ root, clock, store, timerDeps = {} }) {
  const timer = { ...timerDeps, now: clock.now };

  /** @param {string} id @returns {HTMLElement} */
  const el = (id) => {
    const node = root.querySelector(`#${id}`);
    if (!(node instanceof HTMLElement)) throw new Error(`Thiếu phần tử #${id} trong trang`);
    return node;
  };
  const dom = {
    offset: el('offset'), productStatus: el('product-status'), stock: el('stock'),
    saleLabel: el('sale-label'), saleTime: el('sale-time'),
    holdPanel: el('hold-panel'), holdStatus: el('hold-status'), holdTimerLine: el('hold-timer-line'), holdTime: el('hold-time'),
    status: el('status'), alert: el('alert'), simResult: el('sim-result'),
  };

  /** @type {Inventory} */
  let snapshot = await store.read();
  /** @type {number | null} */
  let myId = null;
  let busy = false;
  /** @type {number | null} */
  let saleTarget = null;
  let cancelSale = () => {};
  /** @type {number | null} */
  let holdTarget = null;
  let cancelHold = () => {};
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let wakeTimer;
  /** @type {number | null} */
  let expiredAnnouncedFor = null;
  const tracker = createMilestoneTracker(HOLD_MILESTONES);

  /** @param {HTMLElement} timeEl @param {number} ms */
  function renderTime(timeEl, ms) {
    const { clock: text, millis } = splitRemaining(ms);
    const [clockSpan, msSpan] = /** @type {HTMLElement[]} */ ([...timeEl.children]);
    if (clockSpan.textContent !== text) clockSpan.textContent = text;
    msSpan.textContent = `.${millis}`;
    timeEl.dateTime = toIsoDuration(ms);
  }

  /** Thay hẳn node mới để trình đọc màn hình đọc lại kể cả khi nội dung giống lần trước. @param {'status'|'alert'} level @param {string} text */
  function announce(level, text) {
    const p = root.ownerDocument.createElement('p');
    p.textContent = text;
    dom[level].replaceChildren(p);
  }

  /** @param {number | null} target */
  function ensureSaleCountdown(target) {
    if (target === saleTarget) return;
    cancelSale();
    saleTarget = target;
    if (target === null) return;
    cancelSale = createCountdown(target, (remaining) => {
      renderTime(dom.saleTime, remaining);
      if (remaining === 0) render();
    }, timer);
  }

  /** @param {number | null} target mốc hết hạn của lượt giữ đang hoạt động */
  function ensureHoldCountdown(target) {
    if (target === holdTarget) return;
    cancelHold();
    clearTimeout(wakeTimer);
    holdTarget = target;
    if (target === null) return;
    tracker.arm(target - clock.now());
    cancelHold = createCountdown(target, onHoldTick, timer);
    // Tab ẩn làm rAF dừng, nên cần một lần đánh thức độc lập để hàng được nhả đúng hạn.
    wakeTimer = setTimeout(() => void expireDue(), Math.max(0, target - clock.now()) + EXPIRY_WAKE_SLACK_MS);
  }

  /** @param {number} remaining */
  function onHoldTick(remaining) {
    renderTime(dom.holdTime, remaining);
    const milestone = tracker.check(remaining);
    if (milestone) {
      announce(milestone.level, milestone.text);
      if (milestone.id === 'm0') expiredAnnouncedFor = myId;
    }
    if (remaining === 0) void expireDue();
  }

  /** @param {string} action @param {boolean} visible */
  function setVisible(action, visible) {
    const button = root.querySelector(`button[data-action="${action}"]`);
    if (button instanceof HTMLElement) button.hidden = !visible;
  }

  function render() {
    const now = clock.now();
    const { startsAt, endsAt } = snapshot.saleWindow;
    const phase = now < startsAt ? 'upcoming' : now >= endsAt ? 'ended' : 'live';
    const left = available(snapshot);
    const mine = snapshot.reservations.find((r) => r.id === myId);
    const holding = mine?.status === 'RESERVED' || mine?.status === 'CHECKOUT';

    dom.productStatus.textContent =
      phase === 'upcoming' ? 'Chưa mở bán' : phase === 'ended' ? 'Đã kết thúc' : left > 0 ? 'Đang mở bán' : 'Đã hết hàng';
    dom.stock.textContent = `Tồn kho: còn ${left} / ${snapshot.total} sản phẩm`;
    dom.saleLabel.textContent = phase === 'upcoming' ? 'Mở bán sau' : phase === 'live' ? 'Kết thúc sau' : 'Đợt sale đã kết thúc';
    dom.saleTime.hidden = phase === 'ended';
    ensureSaleCountdown(phase === 'upcoming' ? startsAt : phase === 'live' ? endsAt : null);

    const reserveButton = root.querySelector('button[data-action="reserve"]');
    if (reserveButton instanceof HTMLButtonElement) reserveButton.disabled = !(phase === 'live' && left > 0 && !holding);

    dom.holdPanel.hidden = !mine;
    if (mine) {
      dom.holdStatus.textContent = HOLD_STATUS_TEXT[mine.status];
      dom.holdTimerLine.hidden = !holding;
      setVisible('checkout', mine.status === 'RESERVED');
      setVisible('extend', mine.status === 'RESERVED' && mine.extensions < MAX_EXTENSIONS);
      setVisible('pay', mine.status === 'CHECKOUT');
      setVisible('pay-fail', mine.status === 'CHECKOUT');
      setVisible('cancel', holding);
      if (mine.status === 'EXPIRED' && expiredAnnouncedFor !== mine.id) {
        expiredAnnouncedFor = mine.id;
        announce('alert', /** @type {{ text: string }} */ (HOLD_MILESTONES.find((m) => m.id === 'm0')).text);
      }
    }
    ensureHoldCountdown(holding && mine ? mine.expiresAt : null);
  }

  async function refresh() {
    snapshot = await store.read();
    render();
  }

  async function expireDue() {
    await commitWithRetry(store, () => ({ event: { type: 'EXPIRE_DUE' } }));
    await refresh();
  }

  /** @param {EventInput} event @param {string} okMessage */
  async function sendOwnEvent(event, okMessage) {
    const outcome = await commitWithRetry(store, () => ({ event }));
    if (outcome.status === 'DONE') {
      announce('status', outcome.result.ok ? okMessage : REASON_TEXT[outcome.result.reason]);
    } else {
      announce('status', 'Hệ thống đang bận, vui lòng thử lại.');
    }
  }

  async function reserve() {
    const outcome = await reserveWithRetry(store, ME);
    if (outcome.status === 'RESERVED') {
      myId = outcome.id;
      announce('status', 'Đã giữ hàng. Hãy thanh toán trước khi đồng hồ về 0, hoặc gia hạn thêm.');
    } else if (outcome.status === 'SOLD_OUT') {
      announce('status', REASON_TEXT.SOLD_OUT);
    } else if (outcome.status === 'REJECTED') {
      announce('status', REASON_TEXT[/** @type {keyof typeof REASON_TEXT} */ (outcome.reason)] ?? 'Không thể giữ hàng.');
    } else {
      announce('status', 'Hệ thống đang bận, vui lòng thử lại.');
    }
  }

  /** @param {string} label @param {string} value */
  function addRow(list, label, value) {
    const dt = root.ownerDocument.createElement('dt');
    dt.textContent = label;
    const dd = root.ownerDocument.createElement('dd');
    dd.textContent = value;
    list.append(dt, dd);
  }

  async function simulate() {
    const real = await simulateBuyers({ count: 200, total: 10, seed: Date.now() % 100_000 });
    const naive = await simulateNaiveBuyers({ count: 200, total: 10, seed: Date.now() % 100_000 });

    const doc = root.ownerDocument;
    const heading = (/** @type {string} */ text) => {
      const h = doc.createElement('h3');
      h.className = 'sim-heading';
      h.textContent = text;
      return h;
    };
    const realList = doc.createElement('dl');
    addRow(realList, 'Giữ hàng thành công', String(real.reserved));
    addRow(realList, 'Báo hết hàng', String(real.soldOut));
    addRow(realList, 'Bỏ cuộc sau khi thử lại', String(real.gaveUp));
    addRow(realList, 'Lần xung đột (CONFLICT)', String(real.conflicts));
    addRow(realList, 'Bán quá số lượng', real.reserved > real.total ? 'Có' : 'Không');
    addRow(realList, 'Bất biến kho', real.invariantsOk ? 'Đạt' : 'Vi phạm');
    const naiveList = doc.createElement('dl');
    addRow(naiveList, 'Người được báo thành công', String(naive.toldSuccess));
    addRow(naiveList, 'Lượt giữ còn lại trong kho', String(naive.held));
    addRow(naiveList, 'Bán quá số lượng', naive.oversold ? 'Có' : 'Không');
    dom.simResult.replaceChildren(heading('Khóa lạc quan (version)'), realList, heading('Bản ngây thơ (không kiểm version)'), naiveList);
    announce('status', `Mô phỏng xong: ${real.reserved} trên ${real.count} người giữ được hàng, không bán quá. Bản ngây thơ báo thành công cho ${naive.toldSuccess} người.`);
  }

  /** @type {Record<string, () => Promise<void>>} */
  const actions = {
    reserve,
    checkout: () => sendOwnEvent({ type: 'BEGIN_CHECKOUT', id: /** @type {number} */ (myId) }, 'Đã chuyển sang bước thanh toán.'),
    extend: () => sendOwnEvent({ type: 'EXTEND', id: /** @type {number} */ (myId) }, 'Đã gia hạn thêm 1 phút.'),
    pay: () => sendOwnEvent({ type: 'PAY_SUCCESS', id: /** @type {number} */ (myId) }, 'Thanh toán thành công. Cảm ơn bạn đã mua hàng.'),
    'pay-fail': () => sendOwnEvent({ type: 'PAY_FAIL', id: /** @type {number} */ (myId) }, 'Thanh toán thất bại. Hàng đã được trả về kho.'),
    cancel: () => sendOwnEvent({ type: 'CANCEL', id: /** @type {number} */ (myId) }, 'Đã hủy giữ hàng.'),
    simulate,
  };

  /**
   * Nút vừa bấm có thể bị ẩn hoặc vô hiệu (vd. Giữ hàng), khi đó trình duyệt đẩy focus về <body>
   * và người dùng bàn phím phải Tab lại từ đầu trang (WCAG 2.4.3). Đưa focus về tiêu đề panel giữ hàng.
   */
  function keepFocus() {
    const doc = root.ownerDocument;
    const active = doc.activeElement;
    const lost = !active || active === doc.body || active.closest('[hidden]') !== null || (active instanceof HTMLButtonElement && active.disabled);
    if (lost && !dom.holdPanel.hidden) el('hold-title').focus();
  }

  // Hub sự kiện duy nhất: một listener ở root; nút là <button> nên Enter và Space đã kích hoạt click.
  /** @param {Event} event */
  async function onClick(event) {
    const target = event.target instanceof Element ? event.target.closest('button[data-action]') : null;
    if (!(target instanceof HTMLButtonElement) || target.disabled || busy) return;
    const run = actions[target.dataset.action ?? ''];
    if (!run) return;
    busy = true;
    try {
      await run();
      await refresh();
      keepFocus();
    } catch (error) {
      announce('alert', `Có lỗi: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      busy = false;
    }
  }

  function onVisibilityChange() {
    if (root.ownerDocument.visibilityState === 'visible') void expireDue();
  }

  root.addEventListener('click', onClick);
  root.ownerDocument.addEventListener('visibilitychange', onVisibilityChange);

  const skew = Math.round(clock.offset());
  dom.offset.textContent = `Đồng hồ dùng giờ máy chủ. Chênh lệch so với giờ máy bạn: ${skew >= 0 ? '+' : ''}${skew} ms.`;
  render();

  return {
    refresh,
    destroy() {
      cancelSale();
      cancelHold();
      clearTimeout(wakeTimer);
      root.removeEventListener('click', onClick);
      root.ownerDocument.removeEventListener('visibilitychange', onVisibilityChange);
    },
  };
}
