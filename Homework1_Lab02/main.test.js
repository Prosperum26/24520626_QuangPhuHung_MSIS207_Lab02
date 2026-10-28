import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EMPLOYEE_COLUMNS } from './src/data/employee-columns.js';
import { EMPLOYEES } from './src/data/employees.js';

// cwd là gốc repo khi chạy npm test
const read = (file) => readFileSync(`Homework1_Lab02/${file}`, 'utf8');

describe('main.js (E1)', () => {
  it('mounts the grid, wires the hub once, and reports Enter selections outside the grid', async () => {
    const main = document.createElement('main');
    const app = document.createElement('div');
    app.id = 'app';
    const status = document.createElement('p');
    status.id = 'status';
    const opened = document.createElement('p');
    opened.id = 'opened';
    main.append(app, status, opened);
    document.body.replaceChildren(main);

    await import('./main.js');
    expect(app.querySelectorAll('tbody tr')).toHaveLength(10);
    expect(app.querySelector('table').getAttribute('aria-label')).toBe('Employees');

    // Hub gắn đúng một lần: nếu gắn hai lần thì một click sort sẽ chạy hai handler và quay về trạng thái cũ.
    app.querySelector('thead button').click();
    expect(app.querySelector('th').getAttribute('aria-sort')).toBe('ascending');

    const cell = app.querySelector('#data-grid-r1-c0');
    cell.focus();
    cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(opened.textContent).toContain('Last selected with Enter:');
  });
});

describe('employee columns (E1)', () => {
  it('only references real fields of the data and is frozen', () => {
    const fields = Object.keys(EMPLOYEES[0]);
    expect(EMPLOYEE_COLUMNS.every((column) => fields.includes(column.accessorKey))).toBe(true);
    expect(Object.isFrozen(EMPLOYEE_COLUMNS)).toBe(true);
  });

  it('has sortable columns of text, number and date kinds', () => {
    const sortable = EMPLOYEE_COLUMNS.filter((column) => column.sortable).map((column) => column.accessorKey);
    expect(sortable).toEqual(expect.arrayContaining(['name', 'salary', 'joined']));
  });
});

describe('index.html (E1)', () => {
  const html = read('index.html');

  it('declares language, viewport, a meaningful title and a favicon (no 404 in the console)', () => {
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('name="viewport"');
    expect(html).toMatch(/<title>[^<]{10,}<\/title>/);
    expect(html).toContain('rel="icon"');
  });

  it('has one h1 inside main, #app, and a role=status region outside #app', () => {
    expect(html.match(/<h1>/g)).toHaveLength(1);
    expect(html).toMatch(/<main>[\s\S]*<h1>[\s\S]*<\/main>/);
    expect(html).toContain('<div id="app"></div>');
    expect(html).toContain('<p id="status" role="status"></p>');
  });

  it('uses an ES module script and no inline handlers', () => {
    expect(html).toContain('<script type="module" src="./main.js">');
    expect(html).not.toMatch(/\son[a-z]+=/i);
  });
});

describe('style.css (E1)', () => {
  const css = read('style.css');

  it('keeps a visible focus style, inset for cells so the scroll container does not clip it', () => {
    expect(css).toContain(':focus-visible');
    expect(css).toMatch(/td:focus-visible[^{]*\{[^}]*outline-offset:\s*-/s);
  });

  it('keeps control targets at least 2.5rem', () => {
    expect(css).toMatch(/min-height:\s*2\.5rem/);
    expect(css).toMatch(/min-width:\s*2\.5rem/);
  });

  it('scrolls only the table sideways (reflow)', () => {
    expect(css).toMatch(/\.grid-scroll\s*\{[^}]*overflow-x:\s*auto/s);
  });

  it('marks selected rows by more than colour (bar and check mark)', () => {
    expect(css).toMatch(/tr\[aria-selected='true'\][^{]*\{[^}]*font-weight/s);
    expect(css).toMatch(/aria-selected='true'\]\s*td:first-child\s*\{[^}]*box-shadow/s);
    expect(css).toContain("content: '✓ '");
  });

  it('styles aria-disabled and aria-current, with a non-colour cue for disabled', () => {
    expect(css).toMatch(/\[aria-disabled='true'\]\s*\{[^}]*border-style:\s*dashed/s);
    expect(css).toMatch(/\[aria-current='page'\]\s*\{[^}]*text-decoration:\s*underline/s);
  });
});
