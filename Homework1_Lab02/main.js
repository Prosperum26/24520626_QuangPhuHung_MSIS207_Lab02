// @ts-check
import { EMPLOYEE_COLUMNS } from './src/data/employee-columns.js';
import { EMPLOYEES } from './src/data/employees.js';
import { renderApp, setupEventDelegation } from './src/engine/reactive-engine.js';
import { createDataGrid } from './src/grid/data-grid.js';

const root = document.getElementById('app');
if (root === null) throw new Error('Missing #app container in index.html');

/** Kết quả của Enter hiện ngoài grid, để thấy `onRowSelect` nhận đúng item (kể cả sau sort hay sang trang). */
const opened = document.getElementById('opened');

// Hub trước, render sau: mọi click sau lần render đầu đã có listener ở root.
setupEventDelegation(root);
renderApp(
  createDataGrid({
    data: EMPLOYEES.slice(),
    columns: EMPLOYEE_COLUMNS.slice(),
    ariaLabel: 'Employees',
    onRowSelect: (employee) => {
      if (opened !== null) opened.textContent = `Last selected with Enter: ${employee.name}, ${employee.department}`;
    },
  }),
  root,
);
