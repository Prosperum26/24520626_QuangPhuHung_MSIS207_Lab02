// @ts-check

/** @typedef {import('./state-machine.js').Item} Item */
/** @typedef {() => Promise<Item[]>} FetchFeed */
/** @typedef {number | 'fail'} PlanStep */

/** @type {readonly Item[]} */
export const FEED_ITEMS = Object.freeze([
  Object.freeze({ id: 'feed-1', title: 'Release notes', summary: 'What changed in this version.' }),
  Object.freeze({ id: 'feed-2', title: 'Maintenance window', summary: 'Planned downtime on Sunday.' }),
  Object.freeze({ id: 'feed-3', title: 'New teammate', summary: 'Please welcome the newest member.' }),
]);

/**
 * Mock cho test: promise treo, test tự resolve/reject theo thứ tự nó muốn.
 * @returns {{ fetchFeed: FetchFeed, calls: { resolve: (items: Item[]) => void, reject: (error: unknown) => void }[] }}
 */
export function createDeferredFeed() {
  const calls = [];
  const fetchFeed = () =>
    new Promise((resolve, reject) => {
      calls.push({ resolve, reject });
    });
  return { fetchFeed, calls };
}

const DEFAULT_PLAN = Object.freeze([300]);
const FAIL_DELAY_MS = 300;

/** @param {string} text @returns {PlanStep | null} */
function parseStep(text) {
  const step = text.trim();
  if (step === 'fail') return 'fail';
  const delay = Number(step);
  return step !== '' && Number.isFinite(delay) && delay >= 0 ? delay : null;
}

/**
 * `?plan=3000,500,fail` -> [3000, 500, 'fail']. Bước sai bị bỏ; rỗng thì dùng kế hoạch mặc định.
 * @param {string} search
 * @returns {PlanStep[]}
 */
export function parsePlan(search) {
  const raw = new URLSearchParams(search).get('plan') ?? '';
  const steps = raw.split(',').map(parseStep).filter((step) => step !== null);
  return steps.length > 0 ? steps : [...DEFAULT_PLAN];
}

/**
 * Mock cho demo: yêu cầu thứ n dùng bước thứ n của kế hoạch, hết thì lặp bước cuối.
 * Tên item ghi số yêu cầu để thấy phản hồi nào đang hiển thị.
 * @param {PlanStep[]} plan
 * @returns {FetchFeed}
 */
export function createTimedFeed(plan) {
  const steps = plan.length > 0 ? plan : DEFAULT_PLAN;
  let requestNumber = 0;
  return () => {
    requestNumber += 1;
    const number = requestNumber;
    const step = steps[Math.min(number, steps.length) - 1];
    return new Promise((resolve, reject) => {
      if (step === 'fail') {
        setTimeout(() => reject(new Error('Network unreachable')), FAIL_DELAY_MS);
        return;
      }
      setTimeout(
        () => resolve(FEED_ITEMS.map((item) => ({ ...item, title: `${item.title} (request #${number})` }))),
        step,
      );
    });
  };
}
