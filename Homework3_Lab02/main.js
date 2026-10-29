// @ts-check
import { createServerClock } from './src/clock/server-clock.js';
import { mountFlashSale } from './src/app/flash-sale-app.js';
import { createInventory } from './src/inventory/inventory-fsm.js';
import { createInventoryStore } from './src/inventory/inventory-store.js';
import { createFakeServer } from './src/sim/fake-server.js';

const TOTAL_STOCK = 10;
const SALE_STARTS_IN_MS = 8_000;
const SALE_LASTS_MS = 10 * 60_000;
const NETWORK_LATENCY_MS = 80;

/** `?skew=ms` giả lập máy khách lệch giờ so với máy chủ, để xem đồng hồ vẫn đúng. */
export async function start(doc = document, search = globalThis.location?.search ?? '') {
  const skewMs = Number(new URLSearchParams(search).get('skew')) || 0;
  const server = createFakeServer({ skewMs, latencyMs: NETWORK_LATENCY_MS });
  const clock = createServerClock({ serverNow: server.serverNow });
  await clock.sync();

  const t = clock.now();
  const store = createInventoryStore({
    initial: createInventory({ total: TOTAL_STOCK, saleWindow: { startsAt: t + SALE_STARTS_IN_MS, endsAt: t + SALE_LASTS_MS } }),
    now: clock.now,
    delay: server.delay,
  });
  return mountFlashSale({ root: /** @type {HTMLElement} */ (doc.getElementById('main')), clock, store });
}

export const ready = start();
