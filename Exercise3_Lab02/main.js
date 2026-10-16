// @ts-check
import { createDataFeed } from './data-feed.js';
import { createTimedFeed, parsePlan } from './feed-mock.js';
import { renderApp, setupEventDelegation } from './reactive-engine.js';

const root = document.getElementById('app');
if (root === null) throw new Error('Missing #app container in index.html');

// Kế hoạch demo lấy từ URL, ví dụ ?plan=3000,500 (yêu cầu 1 chậm, yêu cầu 2 nhanh) để thấy race.
const fetchFeed = createTimedFeed(parsePlan(location.search));

// Hub trước, render sau: mọi click sau lần render đầu đã có listener ở root.
setupEventDelegation(root);
renderApp(createDataFeed({ fetchFeed }), root);
