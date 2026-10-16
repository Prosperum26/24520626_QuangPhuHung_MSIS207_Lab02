import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderApp, resetCursor, setRenderer, setupEventDelegation, stateStore } from './reactive-engine.js';
import { TaskApp, visibleTasks } from './task-app.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

beforeEach(() => {
  stateStore.length = 0;
  resetCursor();
  setRenderer(null);
});

/** Dựng app vào body giống index.html: #status nằm ngoài root. */
function setup() {
  document.body.replaceChildren();
  const root = document.createElement('div');
  const status = document.createElement('p');
  status.id = 'status';
  status.setAttribute('role', 'status');
  document.body.append(root, status);
  setupEventDelegation(root);
  renderApp(TaskApp, root);
  return { root, status };
}

function add(root, title) {
  root.querySelector('#task-title').value = title;
  root.querySelector('#add-task').click();
}

const titles = (root) => [...root.querySelectorAll('.task__title')].map((node) => node.textContent);

describe('visibleTasks (hàm thuần)', () => {
  const tasks = [
    { id: 'a', title: 'A', done: false },
    { id: 'b', title: 'B', done: true },
  ];

  it('ALL giữ nguyên, ACTIVE chỉ chưa xong, DONE chỉ đã xong', () => {
    expect(visibleTasks(tasks, 'ALL')).toEqual(tasks);
    expect(visibleTasks(tasks, 'ACTIVE').map((t) => t.id)).toEqual(['a']);
    expect(visibleTasks(tasks, 'DONE').map((t) => t.id)).toEqual(['b']);
  });

  it('không làm đổi mảng đầu vào', () => {
    const copy = structuredClone(tasks);
    visibleTasks(tasks, 'ACTIVE');
    expect(tasks).toEqual(copy);
  });
});

describe('render ban đầu (D1)', () => {
  it('có h1, h2 đếm task và hai task seed', () => {
    const { root } = setup();
    expect(root.querySelector('h1').textContent).toBe('Task Manager');
    expect(root.querySelector('h2').textContent).toBe('Tasks: 2');
    expect(titles(root)).toEqual(['Review PR', 'Verify AST']);
  });
});

describe('thêm task (D2)', () => {
  it('bấm Add Task thêm task, đếm cập nhật, ô nhập được xoá', () => {
    const { root } = setup();
    add(root, 'Write tests');
    expect(titles(root)).toEqual(['Review PR', 'Verify AST', 'Write tests']);
    expect(root.querySelector('h2').textContent).toBe('Tasks: 3');
    expect(root.querySelector('#task-title').value).toBe('');
  });

  it('task mới có id UUID từ crypto.randomUUID', () => {
    const { root } = setup();
    add(root, 'x');
    const toggle = [...root.querySelectorAll('button')].find((b) => b.id.startsWith('toggle-') && !b.id.includes('seed'));
    expect(toggle.id.replace('toggle-', '')).toMatch(UUID_PATTERN);
  });

  it('bỏ qua tiêu đề rỗng hoặc chỉ khoảng trắng và báo lỗi qua status', () => {
    const { root, status } = setup();
    add(root, '   ');
    expect(titles(root)).toHaveLength(2);
    expect(status.textContent).toBe('Enter a task title first.');
  });

  it('cắt khoảng trắng hai đầu', () => {
    const { root } = setup();
    add(root, '  Spaced  ');
    expect(titles(root).at(-1)).toBe('Spaced');
  });

  it('Enter trong ô nhập thêm task (keydown + e.key)', () => {
    const { root } = setup();
    const input = root.querySelector('#task-title');
    input.value = 'By Enter';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(titles(root).at(-1)).toBe('By Enter');
  });

  it('phím khác Enter và Enter đang gõ IME (isComposing) không thêm task', () => {
    const { root } = setup();
    const input = root.querySelector('#task-title');
    input.value = 'Nope';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true }));
    expect(titles(root)).toHaveLength(2);
  });

  it('tiêu đề chứa HTML hiện như text, không tạo element (XSS)', () => {
    const { root } = setup();
    add(root, '<img src=x onerror=alert(1)>');
    expect(root.querySelector('img')).toBeNull();
    expect(titles(root).at(-1)).toBe('<img src=x onerror=alert(1)>');
  });

  it('thông báo "Added" qua vùng status', () => {
    const { root, status } = setup();
    add(root, 'Ship it');
    expect(status.textContent).toBe('Added: Ship it');
  });
});

describe('đánh dấu xong và xoá (D3)', () => {
  it('toggle chỉ đổi đúng task, hiện chữ Completed và đổi nhãn nút', () => {
    const { root } = setup();
    root.querySelector('#toggle-seed-1').click();
    const items = root.querySelectorAll('li');
    expect(items[0].textContent).toContain('Completed');
    expect(items[1].textContent).not.toContain('Completed');
    expect(root.querySelector('#toggle-seed-1').textContent).toBe('Mark not done');
    expect(root.querySelector('#toggle-seed-1').getAttribute('aria-label')).toBe('Mark not done: Review PR');
  });

  it('toggle hai lần trở về trạng thái cũ', () => {
    const { root } = setup();
    root.querySelector('#toggle-seed-1').click();
    root.querySelector('#toggle-seed-1').click();
    expect(root.querySelector('li').textContent).not.toContain('Completed');
  });

  it('xoá bỏ đúng task và cập nhật đếm', () => {
    const { root, status } = setup();
    root.querySelector('#delete-seed-1').click();
    expect(titles(root)).toEqual(['Verify AST']);
    expect(root.querySelector('h2').textContent).toBe('Tasks: 1');
    expect(status.textContent).toBe('Deleted: Review PR');
  });

  it('xoá hết thì hiện thông báo trống thay cho <ul> rỗng', () => {
    const { root } = setup();
    root.querySelector('#delete-seed-1').click();
    root.querySelector('#delete-seed-2').click();
    expect(root.querySelector('ul')).toBeNull();
    expect(root.textContent).toContain('No tasks to show.');
  });
});

describe('danh sách (key và giới hạn ô nhập)', () => {
  it('mỗi <li> có key là task.id, không phải index', () => {
    const { root } = setup();
    add(root, 'Keyed');
    const keys = [...root.querySelectorAll('li')].map((li) => li._vnode.props.key);
    expect(keys.slice(0, 2)).toEqual(['seed-1', 'seed-2']);
    expect(keys[2]).toMatch(UUID_PATTERN);
  });

  it('giới hạn đã biết: chữ đang gõ trong ô nhập mất khi control khác làm re-render', () => {
    const { root } = setup();
    root.querySelector('#task-title').value = 'draft';
    root.querySelector('#toggle-seed-1').click();
    expect(root.querySelector('#task-title').value).toBe('');
  });
});

describe('bộ lọc (D4)', () => {
  it('aria-pressed phản ánh nút đang chọn, luôn có thuộc tính "true"/"false"', () => {
    const { root } = setup();
    const pressed = () =>
      [...root.querySelectorAll('.filters button')].map((b) => `${b.textContent}:${b.getAttribute('aria-pressed')}`);
    expect(pressed()).toEqual(['All:true', 'Active:false', 'Done:false']);
    root.querySelector('#filter-done').click();
    expect(pressed()).toEqual(['All:false', 'Active:false', 'Done:true']);
  });

  it('lọc DONE / ACTIVE / ALL đổi danh sách ngay', () => {
    const { root } = setup();
    root.querySelector('#toggle-seed-2').click();

    root.querySelector('#filter-done').click();
    expect(titles(root)).toEqual(['Verify AST']);

    root.querySelector('#filter-active').click();
    expect(titles(root)).toEqual(['Review PR']);

    root.querySelector('#filter-all').click();
    expect(titles(root)).toEqual(['Review PR', 'Verify AST']);
  });

  it('bộ đếm Tasks luôn là tổng, không theo bộ lọc', () => {
    const { root } = setup();
    root.querySelector('#filter-done').click();
    expect(root.querySelector('h2').textContent).toBe('Tasks: 2');
    expect(root.textContent).toContain('No tasks to show.');
  });

  it('thông báo số task đang hiển thị qua status', () => {
    const { root, status } = setup();
    root.querySelector('#filter-active').click();
    expect(status.textContent).toBe('Showing active tasks: 2');
  });

  it('thêm task khi đang lọc DONE: task mới (chưa xong) không hiện nhưng vẫn được đếm', () => {
    const { root } = setup();
    root.querySelector('#filter-done').click();
    add(root, 'Hidden');
    expect(root.querySelector('h2').textContent).toBe('Tasks: 3');
    expect(titles(root)).toEqual([]);
  });
});

describe('giữ focus sau re-render (D5)', () => {
  it('bấm nút lọc: focus vẫn ở nút lọc đó (nút mới, cùng id)', () => {
    const { root } = setup();
    const before = root.querySelector('#filter-done');
    before.focus();
    before.click();
    const after = root.querySelector('#filter-done');
    expect(after).not.toBe(before);
    expect(document.activeElement).toBe(after);
  });

  it('Enter trong ô nhập: focus ở lại ô nhập', () => {
    const { root } = setup();
    const input = root.querySelector('#task-title');
    input.focus();
    input.value = 'Keep focus';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(document.activeElement).toBe(root.querySelector('#task-title'));
  });

  it('toggle nút của task: focus ở lại đúng nút toggle của task đó', () => {
    const { root } = setup();
    root.querySelector('#toggle-seed-2').focus();
    root.querySelector('#toggle-seed-2').click();
    expect(document.activeElement).toBe(root.querySelector('#toggle-seed-2'));
  });

  it('xoá task đang focus: focus chuyển về tiêu đề đếm, không rơi về body', () => {
    const { root } = setup();
    root.querySelector('#delete-seed-1').focus();
    root.querySelector('#delete-seed-1').click();
    expect(document.activeElement).toBe(root.querySelector('#task-count'));
    expect(document.activeElement.textContent).toBe('Tasks: 1');
  });

  it('toggle trong bộ lọc làm task biến mất: focus cũng về tiêu đề đếm', () => {
    const { root } = setup();
    root.querySelector('#filter-active').click();
    root.querySelector('#toggle-seed-1').focus();
    root.querySelector('#toggle-seed-1').click();
    expect(root.querySelector('#toggle-seed-1')).toBeNull();
    expect(document.activeElement).toBe(root.querySelector('#task-count'));
  });

  it('tiêu đề đếm không nằm trong thứ tự Tab (tabindex -1)', () => {
    const { root } = setup();
    expect(root.querySelector('#task-count').getAttribute('tabindex')).toBe('-1');
  });
});

describe('vùng status (D6)', () => {
  it('nằm ngoài root nên cùng một phần tử sống qua các lần render', () => {
    const { root, status } = setup();
    add(root, 'One');
    root.querySelector('#filter-done').click();
    expect(document.getElementById('status')).toBe(status);
    expect(root.contains(status)).toBe(false);
  });

  it('thông báo đổi theo hành động toggle', () => {
    const { root, status } = setup();
    root.querySelector('#toggle-seed-1').click();
    expect(status.textContent).toBe('Marked done: Review PR');
    root.querySelector('#toggle-seed-1').click();
    expect(status.textContent).toBe('Marked not done: Review PR');
  });
});

describe('cấu trúc ngữ nghĩa và tên truy cập (1.3.1, 4.1.2)', () => {
  it('dùng section/header/h1/ul/li/button, không gắn inline handler', () => {
    const { root } = setup();
    expect(root.querySelector('section > header > h1')).not.toBeNull();
    expect(root.querySelectorAll('ul > li')).toHaveLength(2);
    expect(root.querySelectorAll('[onclick], [onkeydown], [oninput]')).toHaveLength(0);
    expect(root.querySelectorAll('span[role=button], div[role=button]')).toHaveLength(0);
  });

  it('mọi button có tên, mọi input có label, id control là duy nhất', () => {
    const { root } = setup();
    add(root, 'Another');
    for (const button of root.querySelectorAll('button')) {
      const name = button.getAttribute('aria-label') ?? button.textContent;
      expect(name.trim()).not.toBe('');
    }
    const label = root.querySelector('label[for="task-title"]');
    expect(label.textContent).toBe('New task');
    const ids = [...root.querySelectorAll('[id]')].map((node) => node.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('tên truy cập của nút chứa chữ hiển thị (2.5.3 Label in Name)', () => {
    const { root } = setup();
    for (const button of root.querySelectorAll('li button')) {
      const label = button.getAttribute('aria-label').toLowerCase();
      expect(label).toContain(button.textContent.toLowerCase());
    }
  });
});

describe('Checkpoint 2: không có listener mồ côi', () => {
  it('thao tác thêm, toggle, lọc, xoá: mọi addEventListener đều gắn lên root', () => {
    const spy = vi.spyOn(EventTarget.prototype, 'addEventListener');
    const { root } = setup();
    add(root, 'Audit');
    root.querySelector('#toggle-seed-1').click();
    root.querySelector('#filter-active').click();
    root.querySelector('#delete-seed-2').click();

    const targets = [...spy.mock.contexts];
    spy.mockRestore();
    expect(targets).toHaveLength(3);
    expect(targets.every((target) => target === root)).toBe(true);
  });
});
