// @ts-check
import { createElement } from './mini-react.js';
import { useState } from './reactive-engine.js';

// ---------- Contract ----------

/**
 * @typedef {object} Task
 * @property {string} id Bền vững, dùng làm `key` và làm phần id của control.
 * @property {string} title
 * @property {boolean} done
 */

/** @typedef {'ALL' | 'ACTIVE' | 'DONE'} Filter */

/** @type {readonly { value: Filter, label: string }[]} */
const FILTERS = Object.freeze([
  { value: 'ALL', label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'DONE', label: 'Done' },
]);

/** Id cố định để seed ổn định; task thêm sau dùng `crypto.randomUUID()`. */
const SEED_TASKS = Object.freeze([
  Object.freeze({ id: 'seed-1', title: 'Review PR', done: false }),
  Object.freeze({ id: 'seed-2', title: 'Verify AST', done: false }),
]);

const TITLE_INPUT_ID = 'task-title';
const STATUS_ID = 'status';
const COUNT_ID = 'task-count';

// ---------- Pure logic ----------

/**
 * @param {readonly Task[]} tasks
 * @param {Filter} filter
 * @returns {readonly Task[]}
 */
export function visibleTasks(tasks, filter) {
  if (filter === 'ACTIVE') return tasks.filter((task) => !task.done);
  if (filter === 'DONE') return tasks.filter((task) => task.done);
  return tasks;
}

// ---------- Side effect ngoài cây render ----------

/**
 * Vùng `role="status"` nằm ngoài cây bị thay (index.html): vùng live bị tạo lại
 * mỗi lần render thường không được trình đọc màn hình đọc ra (WCAG 4.1.3).
 * @param {string} message
 */
function announce(message) {
  const region = document.getElementById(STATUS_ID);
  if (region !== null) region.textContent = message;
}

/**
 * Khi nút đang focus bị xoá khỏi cây (xoá task, hoặc toggle trong bộ lọc làm task biến mất),
 * focus rơi về <body>. Đưa nó về tiêu đề đếm: không mở bàn phím ảo như ô nhập, và
 * trình đọc màn hình đọc luôn số task mới.
 */
function recoverLostFocus() {
  const lost = document.activeElement === null || document.activeElement === document.body;
  if (lost) document.getElementById(COUNT_ID)?.focus();
}

// ---------- View helpers (trả VNode, không giữ hook) ----------

/**
 * @param {{ onAdd: () => void }} handlers
 */
function renderAddTask({ onAdd }) {
  /** @param {KeyboardEvent} event */
  const onKeydown = (event) => {
    // isComposing: Enter dùng để chốt chữ khi gõ tiếng Việt bằng IME, không phải lệnh thêm.
    if (event.key === 'Enter' && !event.isComposing) onAdd();
  };

  return createElement(
    'div',
    { className: 'add-task' },
    createElement('label', { for: TITLE_INPUT_ID }, 'New task'),
    createElement('input', { id: TITLE_INPUT_ID, type: 'text', autocomplete: 'off', onKeydown }),
    createElement('button', { id: 'add-task', type: 'button', onClick: onAdd }, 'Add Task'),
  );
}

/**
 * @param {Filter} current
 * @param {(value: Filter) => void} onSelect
 */
function renderFilters(current, onSelect) {
  return createElement(
    'div',
    { role: 'group', 'aria-label': 'Filter tasks', className: 'filters' },
    ...FILTERS.map(({ value, label }) =>
      createElement(
        'button',
        {
          id: `filter-${value.toLowerCase()}`,
          type: 'button',
          // Chuỗi "true"/"false": giá trị false thật sẽ bị applyProp bỏ, mất thuộc tính.
          'aria-pressed': String(current === value),
          onClick: () => onSelect(value),
        },
        label,
      ),
    ),
  );
}

/**
 * @param {Task} task
 * @param {{ onToggle: (task: Task) => void, onRemove: (task: Task) => void }} handlers
 */
function renderTaskItem(task, { onToggle, onRemove }) {
  const toggleText = task.done ? 'Mark not done' : 'Mark done';
  return createElement(
    'li',
    { key: task.id, className: task.done ? 'task task--done' : 'task' },
    createElement('span', { className: 'task__title' }, task.title),
    // Trạng thái bằng chữ, không chỉ gạch ngang/đổi màu (WCAG 1.4.1).
    task.done && createElement('span', { className: 'task__badge' }, 'Completed'),
    createElement(
      'button',
      {
        id: `toggle-${task.id}`,
        type: 'button',
        'aria-label': `${toggleText}: ${task.title}`,
        onClick: () => onToggle(task),
      },
      toggleText,
    ),
    createElement(
      'button',
      {
        id: `delete-${task.id}`,
        type: 'button',
        'aria-label': `Delete: ${task.title}`,
        onClick: () => onRemove(task),
      },
      'Delete',
    ),
  );
}

/**
 * @param {readonly Task[]} tasks
 * @param {{ onToggle: (task: Task) => void, onRemove: (task: Task) => void }} handlers
 */
function renderTaskList(tasks, handlers) {
  if (tasks.length === 0) return createElement('p', null, 'No tasks to show.');
  return createElement('ul', { className: 'task-list' }, ...tasks.map((task) => renderTaskItem(task, handlers)));
}

// ---------- Component ----------

export function TaskApp() {
  const [tasks, setTasks] = useState(/** @type {readonly Task[]} */ (SEED_TASKS));
  const [filter, setFilter] = useState(/** @type {Filter} */ ('ALL'));

  const addTask = () => {
    const input = document.getElementById(TITLE_INPUT_ID);
    const title = input instanceof HTMLInputElement ? input.value.trim() : '';
    if (title === '') {
      announce('Enter a task title first.');
      return;
    }
    setTasks((prev) => [...prev, { id: crypto.randomUUID(), title, done: false }]);
    announce(`Added: ${title}`);
  };

  /** @param {Task} task */
  const toggleTask = (task) => {
    setTasks((prev) => prev.map((item) => (item.id === task.id ? { ...item, done: !item.done } : item)));
    announce(`${task.done ? 'Marked not done' : 'Marked done'}: ${task.title}`);
    recoverLostFocus();
  };

  /** @param {Task} task */
  const removeTask = (task) => {
    setTasks((prev) => prev.filter((item) => item.id !== task.id));
    announce(`Deleted: ${task.title}`);
    recoverLostFocus();
  };

  /** @param {Filter} value */
  const selectFilter = (value) => {
    setFilter(value);
    const label = FILTERS.find((item) => item.value === value)?.label ?? value;
    announce(`Showing ${label.toLowerCase()} tasks: ${visibleTasks(tasks, value).length}`);
  };

  return createElement(
    'section',
    { 'aria-labelledby': 'app-title', className: 'task-manager' },
    createElement(
      'header',
      null,
      createElement('h1', { id: 'app-title' }, 'Task Manager'),
      // tabindex -1: focus được bằng script (recoverLostFocus) nhưng không nằm trong thứ tự Tab.
      createElement('h2', { id: COUNT_ID, tabindex: '-1' }, `Tasks: ${tasks.length}`),
    ),
    renderAddTask({ onAdd: addTask }),
    renderFilters(filter, selectFilter),
    renderTaskList(visibleTasks(tasks, filter), { onToggle: toggleTask, onRemove: removeTask }),
  );
}
