import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInventory } from '../inventory/inventory-fsm.js';
import { createInventoryStore } from '../inventory/inventory-store.js';
import { CHECKOUT_MS, HOLD_MS } from '../inventory/types.js';
import { mountFlashSale } from './flash-sale-app.js';

const html = readFileSync('Homework3_Lab02/index.html', 'utf8');
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script'));

const START = 10_000;
const END = 1_000_000;

/** Đồng hồ và rAF giả: frame() chạy các callback rAF đang chờ tại thời điểm hiện tại. */
function makeEnv(now = START) {
  const env = { t: now, queue: new Map(), nextId: 1 };
  env.clock = { now: () => env.t, offset: () => 0 };
  env.timerDeps = {
    raf: (cb) => { const id = env.nextId++; env.queue.set(id, cb); return id; },
    caf: (id) => env.queue.delete(id),
  };
  env.frame = () => { const cbs = [...env.queue.values()]; env.queue.clear(); cbs.forEach((cb) => cb()); };
  return env;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const $ = (id) => document.getElementById(id);
const button = (action) => document.querySelector(`button[data-action="${action}"]`);
async function click(action) {
  button(action).click();
  await flush();
  await flush();
}

let app;
async function mount(env, { total = 2 } = {}) {
  document.body.innerHTML = body; // HTML tĩnh của chính trang, không phải dữ liệu động
  const store = createInventoryStore({
    initial: createInventory({ total, saleWindow: { startsAt: START, endsAt: END } }),
    now: env.clock.now,
  });
  app = await mountFlashSale({ root: $('main'), clock: env.clock, store, timerDeps: env.timerDeps });
  return store;
}

beforeEach(() => { document.body.innerHTML = ''; });
afterEach(() => app?.destroy());

describe('E2 flash-sale app', () => {
  it('shows stock and status as text', async () => {
    await mount(makeEnv());
    expect($('stock').textContent).toContain('còn 2 / 2');
    expect($('product-status').textContent).toBe('Đang mở bán');
    expect($('hold-panel').hidden).toBe(true);
  });

  it('before the sale starts the reserve button is disabled and the status says so', async () => {
    await mount(makeEnv(START - 5_000));
    expect($('product-status').textContent).toBe('Chưa mở bán');
    expect(button('reserve').disabled).toBe(true);
    expect($('sale-label').textContent).toBe('Mở bán sau');
  });

  it('reserve shows the hold panel with the right buttons and announces it', async () => {
    await mount(makeEnv());
    await click('reserve');
    expect($('hold-panel').hidden).toBe(false);
    expect($('hold-status').textContent).toBe('Đang giữ hàng');
    expect($('stock').textContent).toContain('còn 1 / 2');
    expect(button('checkout').hidden).toBe(false);
    expect(button('extend').hidden).toBe(false);
    expect(button('pay').hidden).toBe(true);
    expect(button('reserve').disabled).toBe(true);
    expect($('status').textContent).toContain('Đã giữ hàng');
  });

  it('walks reserve -> checkout -> pay and ends as sold', async () => {
    await mount(makeEnv());
    await click('reserve');
    await click('checkout');
    expect($('hold-status').textContent).toBe('Đang thanh toán');
    expect(button('pay').hidden).toBe(false);
    await click('pay');
    expect($('hold-status').textContent).toBe('Đã mua');
    expect($('stock').textContent).toContain('còn 1 / 2');
    expect($('hold-timer-line').hidden).toBe(true);
  });

  it('a failed payment returns the item to stock', async () => {
    await mount(makeEnv());
    await click('reserve');
    await click('checkout');
    await click('pay-fail');
    expect($('hold-status').textContent).toBe('Đã hủy');
    expect($('stock').textContent).toContain('còn 2 / 2');
  });

  it('extend adds time and stops being offered after the limit', async () => {
    await mount(makeEnv());
    await click('reserve');
    await click('extend');
    await click('extend');
    expect(button('extend').hidden).toBe(true);
  });

  it('moves focus to the hold panel heading when the clicked button becomes disabled (2.4.3)', async () => {
    await mount(makeEnv());
    button('reserve').focus();
    await click('reserve');
    expect(document.activeElement).toBe($('hold-title'));
  });

  it('keeps focus on the clicked button when it stays available', async () => {
    await mount(makeEnv());
    await click('reserve');
    button('extend').focus();
    await click('extend');
    expect(document.activeElement).toBe(button('extend'));
  });

  it('ignores clicks that are not on an action button', async () => {
    await mount(makeEnv());
    $('product-status').click();
    $('main').click();
    await flush();
    expect($('hold-panel').hidden).toBe(true);
  });

  it('renders text without creating elements from markup-like strings', async () => {
    const env = makeEnv();
    const store = await mount(env);
    await store.commit(0, { type: 'RESERVE', buyerId: '<img src=x onerror=alert(1)>' });
    await app.refresh();
    expect(document.querySelector('main img')).toBeNull();
  });
});

describe('E3 milestones and accessibility', () => {
  async function reserved() {
    const env = makeEnv();
    await mount(env);
    await click('reserve');
    return env;
  }

  it('announces 1 minute via role=status exactly once', async () => {
    const env = await reserved();
    env.t = START + HOLD_MS - 59_000;
    env.frame();
    const message = $('status').firstChild;
    expect(message.textContent).toContain('1 phút');
    env.t += 1_000;
    env.frame();
    expect($('status').firstChild).toBe(message);
  });

  it('announces 10 seconds via role=alert', async () => {
    const env = await reserved();
    env.t = START + HOLD_MS - 9_000;
    env.frame();
    expect($('alert').textContent).toContain('10 giây');
  });

  it('expires on time even if the timer never ticks past 0 (lazy expiry via wake-up)', async () => {
    const env = await reserved();
    env.t = START + HOLD_MS + 1;
    env.frame();
    await flush();
    await flush();
    expect($('alert').textContent).toContain('hết thời gian');
    expect($('hold-status').textContent).toBe('Hết hạn giữ hàng');
    expect($('stock').textContent).toContain('còn 2 / 2');
  });

  it('re-announces the 1-minute mark after an extension', async () => {
    const env = await reserved();
    env.t = START + HOLD_MS - 5_000;
    env.frame();
    await click('extend');
    env.t = START + HOLD_MS + 60_000 - 59_000;
    env.frame();
    expect($('status').textContent).toContain('1 phút');
  });

  it('keeps the countdown out of live regions and uses <time>', async () => {
    await mount(makeEnv());
    for (const id of ['sale-time', 'hold-time']) {
      const time = $(id);
      expect(time.tagName).toBe('TIME');
      expect(time.closest('[aria-live], [role="status"], [role="alert"]')).toBeNull();
    }
  });

  it('shows the checkout window length is used after BEGIN_CHECKOUT', async () => {
    const env = makeEnv();
    await mount(env);
    await click('reserve');
    env.t += 5_000;
    await click('checkout');
    env.frame();
    const [clockSpan] = $('hold-time').children;
    expect(clockSpan.textContent).toBe(`0${Math.floor(CHECKOUT_MS / 60_000)}:00`);
  });
});
