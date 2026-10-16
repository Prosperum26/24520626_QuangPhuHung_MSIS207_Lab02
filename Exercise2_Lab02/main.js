// @ts-check
import { renderApp, setupEventDelegation } from './reactive-engine.js';
import { TaskApp } from './task-app.js';

const root = document.getElementById('app');
if (root === null) throw new Error('Missing #app container in index.html');

// Hub trước, render sau: mọi click sau lần render đầu đã có listener ở root.
setupEventDelegation(root);
renderApp(TaskApp, root);
