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
