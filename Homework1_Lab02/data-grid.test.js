import { beforeEach, describe, expect, it } from 'vitest';
import { createDataGrid } from './data-grid.js';
import { EMPLOYEES } from './employees.js';
import { renderApp, resetCursor, setRenderer, setupEventDelegation, stateStore } from './reactive-engine.js';

beforeEach(() => {
  stateStore.length = 0;
  resetCursor();
  setRenderer(null);
});

const columns = [
  { header: 'Name', accessorKey: 'name', sortable: true },
  { header: 'Department', accessorKey: 'department' },
  { header: 'Salary', accessorKey: 'salary', sortable: true },
];

/** Dựng app vào body giống index.html: #status nằm ngoài root. */
function setup({ data = EMPLOYEES, onRowSelect } = {}) {
  document.body.replaceChildren();
  const root = document.createElement('div');
  const status = document.createElement('p');
  status.id = 'status';
  status.setAttribute('role', 'status');
  document.body.append(root, status);
  setupEventDelegation(root);
  renderApp(createDataGrid({ data, columns, ariaLabel: 'Employees', onRowSelect }), root);
  return { root, status };
}

describe('static table (D1)', () => {
  it('uses table > thead > tr > th[scope=col] and tbody > tr > td', () => {
    const { root } = setup();
    const table = root.querySelector('table');
    expect(table.querySelectorAll('thead > tr')).toHaveLength(1);
    const headers = [...table.querySelectorAll('thead > tr > th')];
    expect(headers.map((th) => th.textContent)).toEqual(['Name', 'Department', 'Salary']);
    expect(headers.every((th) => th.getAttribute('scope') === 'col')).toBe(true);
    expect(table.querySelectorAll('tbody > tr')).toHaveLength(10);
    expect(table.querySelectorAll('tbody > tr > td')).toHaveLength(30);
  });

  it('declares the ARIA grid on the table with an accessible name', () => {
    const { root } = setup();
    const table = root.querySelector('table');
    expect(table.getAttribute('role')).toBe('grid');
    expect(table.getAttribute('aria-label')).toBe('Employees');
  });

  it('does not add redundant roles to tr, th or td (they are implicit inside a grid)', () => {
    const { root } = setup();
    expect(root.querySelectorAll('tr[role], th[role], td[role]')).toHaveLength(0);
  });

  it('has no div inside the table (no div-soup)', () => {
    const { root } = setup();
    expect(root.querySelector('table div')).toBeNull();
  });

  it('sets aria-rowcount to the total rows plus the header row', () => {
    const { root } = setup();
    expect(root.querySelector('table').getAttribute('aria-rowcount')).toBe('241');
  });

  it('sets aria-rowindex: header is 1, first data row is 2', () => {
    const { root } = setup();
    expect(root.querySelector('thead tr').getAttribute('aria-rowindex')).toBe('1');
    const indexes = [...root.querySelectorAll('tbody tr')].map((tr) => tr.getAttribute('aria-rowindex'));
    expect(indexes).toEqual(['2', '3', '4', '5', '6', '7', '8', '9', '10', '11']);
  });

  it('renders cell values as text, in column order', () => {
    const { root } = setup();
    const first = [...root.querySelector('tbody tr').children].map((td) => td.textContent);
    expect(first).toEqual([EMPLOYEES[0].name, EMPLOYEES[0].department, String(EMPLOYEES[0].salary)]);
  });

  it('renders null and undefined as empty cells, not the words "null"/"undefined"', () => {
    const { root } = setup({ data: [{ name: null, department: undefined, salary: 0 }] });
    const cells = [...root.querySelector('tbody tr').children].map((td) => td.textContent);
    expect(cells).toEqual(['', '', '0']);
  });

  it('shows <img onerror> in a cell as text and creates no element (XSS)', () => {
    const payload = '<img src=x onerror=alert(1)>';
    const { root } = setup({ data: [{ name: payload, department: 'x', salary: 1 }] });
    expect(root.querySelector('td').textContent).toBe(payload);
    expect(root.querySelector('img')).toBeNull();
  });

  it('shows the header text as text too (XSS in column header)', () => {
    document.body.replaceChildren();
    const root = document.createElement('div');
    document.body.append(root);
    renderApp(
      createDataGrid({ data: [], columns: [{ header: '<b>x</b>', accessorKey: 'name' }], ariaLabel: 'A' }),
      root,
    );
    expect(root.querySelector('th').textContent).toBe('<b>x</b>');
    expect(root.querySelector('b')).toBeNull();
  });

  it('renders an empty tbody for empty data, with rowcount 1 (header only)', () => {
    const { root } = setup({ data: [] });
    expect(root.querySelectorAll('tbody > tr')).toHaveLength(0);
    expect(root.querySelector('table').getAttribute('aria-rowcount')).toBe('1');
  });
});

const names = (root) => [...root.querySelectorAll('tbody tr td:first-child')].map((td) => td.textContent);
const sortButton = (root, header) =>
  [...root.querySelectorAll('thead button')].find((button) => button.textContent.startsWith(header));

describe('sorting (D2)', () => {
  it('puts a button in sortable headers only', () => {
    const { root } = setup();
    expect([...root.querySelectorAll('thead th')].map((th) => th.querySelector('button') !== null)).toEqual([
      true,
      false,
      true,
    ]);
  });

  it('goes ascending, descending, then back to none on repeated clicks', () => {
    const { root } = setup();
    const ariaSort = () => root.querySelector('thead th:first-child').getAttribute('aria-sort');
    expect(ariaSort()).toBeNull();
    sortButton(root, 'Name').click();
    expect(ariaSort()).toBe('ascending');
    sortButton(root, 'Name').click();
    expect(ariaSort()).toBe('descending');
    sortButton(root, 'Name').click();
    expect(ariaSort()).toBeNull();
  });

  it('really reorders the rows by the whole data set, not just the visible page', () => {
    const { root } = setup();
    const lowest = Math.min(...EMPLOYEES.map((e) => e.salary));
    sortButton(root, 'Salary').click();
    expect(root.querySelector('tbody tr td:nth-child(3)').textContent).toBe(String(lowest));
    sortButton(root, 'Name').click();
    const sorted = names(root);
    expect(sorted).toEqual([...sorted].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })));
  });

  it('has at most one aria-sort in the grid, and moves it to the clicked column', () => {
    const { root } = setup();
    sortButton(root, 'Name').click();
    sortButton(root, 'Salary').click();
    const sorted = root.querySelectorAll('[aria-sort]');
    expect(sorted).toHaveLength(1);
    expect(sorted[0].textContent).toContain('Salary');
  });

  it('shows a text indicator for the sorted column and hides it from assistive tech', () => {
    const { root } = setup();
    sortButton(root, 'Name').click();
    const indicator = root.querySelector('.sort-indicator');
    expect(indicator.textContent).toContain('▲');
    expect(indicator.getAttribute('aria-hidden')).toBe('true');
    expect(sortButton(root, 'Name').getAttribute('aria-label')).toBeNull();
  });

  it('announces the sort in #status', () => {
    const { root, status } = setup();
    sortButton(root, 'Name').click();
    expect(status.textContent).toBe('Sorted by Name, ascending');
    sortButton(root, 'Name').click();
    expect(status.textContent).toBe('Sorted by Name, descending');
    sortButton(root, 'Name').click();
    expect(status.textContent).toBe('Sorting cleared');
  });

  it('keeps focus on the clicked header button across the re-render', () => {
    const { root } = setup();
    sortButton(root, 'Name').focus();
    sortButton(root, 'Name').click();
    expect(document.activeElement).toBe(sortButton(root, 'Name'));
  });

  it('does not mutate the original data array', () => {
    const data = EMPLOYEES.slice(0, 5);
    const before = data.map((row) => row.id);
    const { root } = setup({ data });
    sortButton(root, 'Salary').click();
    expect(data.map((row) => row.id)).toEqual(before);
  });
});

/** Giả lập người dùng gõ vào ô lọc. */
function typeFilter(root, value) {
  const input = root.querySelector('#data-grid-filter');
  input.value = value;
  input.setSelectionRange(value.length, value.length);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('filter (D3)', () => {
  it('has a visible label tied to the input by for/id', () => {
    const { root } = setup();
    const label = root.querySelector('label');
    const input = root.querySelector('input[type="search"]');
    expect(label.textContent).toBe('Filter rows');
    expect(label.getAttribute('for')).toBe(input.id);
    expect(label.hasAttribute('htmlfor')).toBe(false);
  });

  it('filters the rows and updates aria-rowcount', () => {
    const { root } = setup();
    typeFilter(root, 'engineering');
    const expected = EMPLOYEES.filter((e) => e.department === 'Engineering').length;
    expect(root.querySelector('table').getAttribute('aria-rowcount')).toBe(String(expected + 1));
    const departments = [...root.querySelectorAll('tbody td:nth-child(2)')].map((td) => td.textContent);
    expect(departments.every((d) => d === 'Engineering')).toBe(true);
  });

  it('announces how many rows are shown', () => {
    const { root, status } = setup();
    typeFilter(root, 'engineering');
    const expected = EMPLOYEES.filter((e) => e.department === 'Engineering').length;
    expect(status.textContent).toBe(`Showing ${expected} of 240 rows`);
  });

  it('keeps the input value, focus and caret after every keystroke', () => {
    const { root } = setup();
    root.querySelector('#data-grid-filter').focus();
    typeFilter(root, 'eng');
    const input = root.querySelector('#data-grid-filter');
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe('eng');
    expect(input.selectionStart).toBe(3);
  });

  it('shows "No matching rows" outside the table, with nothing in tbody, when nothing matches', () => {
    const { root, status } = setup();
    typeFilter(root, 'zzzz');
    expect(root.querySelectorAll('tbody tr')).toHaveLength(0);
    expect(root.querySelector('table').getAttribute('aria-rowcount')).toBe('1');
    expect(root.querySelector('.grid-empty').textContent).toBe('No matching rows');
    expect(root.querySelector('table .grid-empty')).toBeNull();
    expect(status.textContent).toBe('Showing 0 of 240 rows');
  });

  it('does not show the empty message when there are matches, and clears it when the filter is cleared', () => {
    const { root } = setup();
    expect(root.querySelector('.grid-empty')).toBeNull();
    typeFilter(root, 'zzzz');
    typeFilter(root, '');
    expect(root.querySelector('.grid-empty')).toBeNull();
    expect(root.querySelectorAll('tbody tr')).toHaveLength(10);
  });

  it('filters before sorting: both work together', () => {
    const { root } = setup();
    typeFilter(root, 'support');
    sortButton(root, 'Salary').click();
    const salaries = [...root.querySelectorAll('tbody td:nth-child(3)')].map((td) => Number(td.textContent));
    expect(salaries).toEqual([...salaries].sort((a, b) => a - b));
    expect(root.querySelector('#data-grid-filter').value).toBe('support');
  });

  it('treats typed HTML as text in the input value, not markup', () => {
    const { root } = setup();
    typeFilter(root, '<img src=x onerror=alert(1)>');
    expect(root.querySelector('img')).toBeNull();
    expect(root.querySelector('#data-grid-filter').value).toBe('<img src=x onerror=alert(1)>');
  });
});

const pageButton = (root, number) => root.querySelector(`#data-grid-page-${number}`);
const firstRowIndex = (root) => root.querySelector('tbody tr').getAttribute('aria-rowindex');

describe('pagination (D4)', () => {
  it('renders a labelled nav with Previous, a window of 5 numbers and Next', () => {
    const { root } = setup();
    const nav = root.querySelector('nav');
    expect(nav.getAttribute('aria-label')).toBe('Pagination');
    expect([...nav.querySelectorAll('button')].map((b) => b.textContent)).toEqual([
      'Previous',
      '1',
      '2',
      '3',
      '4',
      '5',
      'Next',
    ]);
  });

  it('marks only the current page with aria-current="page"', () => {
    const { root } = setup();
    expect(root.querySelectorAll('[aria-current]')).toHaveLength(1);
    expect(pageButton(root, 1).getAttribute('aria-current')).toBe('page');
    pageButton(root, 3).click();
    expect(root.querySelectorAll('[aria-current]')).toHaveLength(1);
    expect(pageButton(root, 3).getAttribute('aria-current')).toBe('page');
  });

  it('shows the right 10 rows and aria-rowindex for page 3', () => {
    const { root } = setup();
    pageButton(root, 3).click();
    expect(names(root)).toEqual(EMPLOYEES.slice(20, 30).map((e) => e.name));
    expect(firstRowIndex(root)).toBe('22');
  });

  it('announces the page', () => {
    const { root, status } = setup();
    pageButton(root, 3).click();
    expect(status.textContent).toBe('Page 3 of 24');
  });

  it('gives page buttons an accessible name that contains the visible number', () => {
    const { root } = setup();
    expect(pageButton(root, 2).getAttribute('aria-label')).toBe('Page 2');
  });

  it('Previous is aria-disabled on page 1 and does nothing; Next moves forward', () => {
    const { root } = setup();
    const prev = () => root.querySelector('#data-grid-prev');
    expect(prev().getAttribute('aria-disabled')).toBe('true');
    expect(prev().hasAttribute('disabled')).toBe(false);
    prev().click();
    expect(pageButton(root, 1).getAttribute('aria-current')).toBe('page');
    root.querySelector('#data-grid-next').click();
    expect(pageButton(root, 2).getAttribute('aria-current')).toBe('page');
    expect(prev().hasAttribute('aria-disabled')).toBe(false);
  });

  it('Next is aria-disabled on the last page and does not go past it', () => {
    const { root } = setup();
    root.querySelector('#data-grid-next').click();
    for (let i = 0; i < 30; i += 1) root.querySelector('#data-grid-next').click();
    expect(root.querySelector('#data-grid-next').getAttribute('aria-disabled')).toBe('true');
    expect(root.querySelector('[aria-current="page"]').textContent).toBe('24');
    expect(firstRowIndex(root)).toBe('232');
    expect(root.querySelectorAll('tbody tr')).toHaveLength(10);
  });

  it('slides the window and keeps the current page inside it', () => {
    const { root } = setup();
    for (let i = 0; i < 9; i += 1) root.querySelector('#data-grid-next').click();
    const numbers = [...root.querySelectorAll('nav button[aria-label]')].map((b) => b.textContent);
    expect(numbers).toEqual(['8', '9', '10', '11', '12']);
    expect(root.querySelector('[aria-current="page"]').textContent).toBe('10');
  });

  it('keeps focus on the page button that was clicked', () => {
    const { root } = setup();
    pageButton(root, 4).focus();
    pageButton(root, 4).click();
    expect(document.activeElement).toBe(pageButton(root, 4));
  });

  it('keeps focus on Next while paging with it', () => {
    const { root } = setup();
    root.querySelector('#data-grid-next').focus();
    root.querySelector('#data-grid-next').click();
    expect(document.activeElement).toBe(root.querySelector('#data-grid-next'));
  });

  it('shrinks the page count when filtering and goes back to page 1', () => {
    const { root } = setup();
    pageButton(root, 5).click();
    typeFilter(root, 'engineering');
    const expected = Math.ceil(EMPLOYEES.filter((e) => e.department === 'Engineering').length / 10);
    expect(root.querySelector('[aria-current="page"]').textContent).toBe('1');
    expect(root.querySelectorAll('nav button[aria-label]')).toHaveLength(Math.min(5, expected));
  });

  it('goes back to page 1 when the sort changes', () => {
    const { root } = setup();
    pageButton(root, 4).click();
    sortButton(root, 'Name').click();
    expect(root.querySelector('[aria-current="page"]').textContent).toBe('1');
  });

  it('shows a single page button for a short list', () => {
    const { root } = setup({ data: EMPLOYEES.slice(0, 3) });
    expect(root.querySelectorAll('nav button[aria-label]')).toHaveLength(1);
    expect(root.querySelector('#data-grid-next').getAttribute('aria-disabled')).toBe('true');
    expect(root.querySelector('#data-grid-prev').getAttribute('aria-disabled')).toBe('true');
  });
});

const byId = (id) => document.getElementById(id);
const tabStops = (root) => [...root.querySelectorAll('table [tabindex="0"]')];

/** Bắn keydown thật (có bubbles, cancelable) từ phần tử đang focus; trả về event để xem preventDefault. */
function press(key, options = {}) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options });
  document.activeElement.dispatchEvent(event);
  return event;
}

describe('keyboard navigation (D5)', () => {
  it('gives every cell a position-based id', () => {
    const { root } = setup();
    expect(root.querySelectorAll('thead th, thead button')).not.toHaveLength(0);
    expect(byId('data-grid-r0-c0').tagName).toBe('BUTTON');
    expect(byId('data-grid-r0-c1').tagName).toBe('TH');
    expect(byId('data-grid-r1-c0').tagName).toBe('TD');
    expect(byId('data-grid-r10-c2').tagName).toBe('TD');
    expect(byId('data-grid-r11-c0')).toBeNull();
  });

  it('roving tabindex: exactly one tab stop in the table, every other cell is -1', () => {
    const { root } = setup();
    expect(tabStops(root)).toHaveLength(1);
    expect(tabStops(root)[0].id).toBe('data-grid-r0-c0');
    const others = [...root.querySelectorAll('table [id^="data-grid-r"]')].filter((el) => el.id !== 'data-grid-r0-c0');
    expect(others.every((el) => el.getAttribute('tabindex') === '-1')).toBe(true);
  });

  it('moves with the four arrow keys and moves the tab stop with focus', () => {
    const { root } = setup();
    byId('data-grid-r0-c0').focus();
    press('ArrowDown');
    expect(document.activeElement.id).toBe('data-grid-r1-c0');
    press('ArrowRight');
    expect(document.activeElement.id).toBe('data-grid-r1-c1');
    press('ArrowDown');
    expect(document.activeElement.id).toBe('data-grid-r2-c1');
    press('ArrowLeft');
    expect(document.activeElement.id).toBe('data-grid-r2-c0');
    press('ArrowUp');
    expect(document.activeElement.id).toBe('data-grid-r1-c0');
    expect(tabStops(root).map((el) => el.id)).toEqual(['data-grid-r1-c0']);
  });

  it('moves between header cells, button or plain th', () => {
    setup();
    byId('data-grid-r0-c0').focus();
    press('ArrowRight');
    expect(document.activeElement).toBe(byId('data-grid-r0-c1'));
    expect(document.activeElement.tagName).toBe('TH');
    press('ArrowRight');
    expect(document.activeElement.tagName).toBe('BUTTON');
  });

  it('Home/End go to the row edges and Ctrl+Home/Ctrl+End to the grid corners', () => {
    setup();
    byId('data-grid-r3-c1').focus();
    press('End');
    expect(document.activeElement.id).toBe('data-grid-r3-c2');
    press('Home');
    expect(document.activeElement.id).toBe('data-grid-r3-c0');
    press('End', { ctrlKey: true });
    expect(document.activeElement.id).toBe('data-grid-r10-c2');
    press('Home', { ctrlKey: true });
    expect(document.activeElement.id).toBe('data-grid-r0-c0');
  });

  it('stops at the edges, no wrapping, and still prevents page scrolling there', () => {
    setup();
    byId('data-grid-r0-c0').focus();
    expect(press('ArrowUp').defaultPrevented).toBe(true);
    expect(press('ArrowLeft').defaultPrevented).toBe(true);
    expect(document.activeElement.id).toBe('data-grid-r0-c0');
    byId('data-grid-r10-c2').focus();
    press('ArrowDown');
    press('ArrowRight');
    expect(document.activeElement.id).toBe('data-grid-r10-c2');
  });

  it('does not swallow keys it does not use or browser shortcuts (Alt+Left, Tab, letters)', () => {
    setup();
    byId('data-grid-r2-c1').focus();
    expect(press('a').defaultPrevented).toBe(false);
    expect(press('Tab').defaultPrevented).toBe(false);
    expect(press('ArrowLeft', { altKey: true }).defaultPrevented).toBe(false);
    expect(press('ArrowLeft', { metaKey: true }).defaultPrevented).toBe(false);
    expect(document.activeElement.id).toBe('data-grid-r2-c1');
  });

  it('prevents default on arrows so the page does not scroll', () => {
    setup();
    byId('data-grid-r1-c0').focus();
    expect(press('ArrowDown').defaultPrevented).toBe(true);
  });

  it('works from e.key alone (no keyCode needed)', () => {
    setup();
    byId('data-grid-r1-c0').focus();
    const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
    expect(event.keyCode).toBe(0);
    document.activeElement.dispatchEvent(event);
    expect(document.activeElement.id).toBe('data-grid-r2-c0');
  });

  it('clicking a cell makes it the tab stop', () => {
    const { root } = setup();
    byId('data-grid-r3-c1').focus();
    byId('data-grid-r3-c1').click();
    expect(tabStops(root).map((el) => el.id)).toEqual(['data-grid-r3-c1']);
    expect(document.activeElement.id).toBe('data-grid-r3-c1');
  });

  it('keeps focus in the grid (never <body>) after paging, with the same cell position', () => {
    setup();
    byId('data-grid-r4-c1').focus();
    byId('data-grid-page-2').click();
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement.id).toBe('data-grid-r4-c1');
  });

  it('after a header sort click, the sorted column header is the tab stop and keeps focus', () => {
    const { root } = setup();
    byId('data-grid-r0-c2').focus();
    byId('data-grid-r0-c2').click();
    expect(document.activeElement.id).toBe('data-grid-r0-c2');
    expect(tabStops(root).map((el) => el.id)).toEqual(['data-grid-r0-c2']);
  });

  it('clamps the active cell when the page has fewer rows, leaving exactly one tab stop', () => {
    const { root } = setup({ data: EMPLOYEES.slice(0, 12) });
    byId('data-grid-r10-c0').focus();
    byId('data-grid-r10-c0').click();
    byId('data-grid-page-2').click();
    expect(root.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(tabStops(root)).toHaveLength(1);
    expect(tabStops(root)[0].id).toBe('data-grid-r2-c0');
  });

  it('ignores keydown from controls outside the grid cells (filter input, pagination)', () => {
    setup();
    const input = byId('data-grid-filter');
    input.focus();
    expect(press('ArrowDown').defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(input);
    const next = byId('data-grid-next');
    next.focus();
    expect(press('ArrowRight').defaultPrevented).toBe(false);
  });

  it('grid with no data rows: only the header is navigable and still has one tab stop', () => {
    const { root } = setup({ data: [] });
    expect(tabStops(root)).toHaveLength(1);
    byId('data-grid-r0-c0').focus();
    press('ArrowDown');
    expect(document.activeElement.id).toBe('data-grid-r0-c0');
  });
});

const rowSelected = (root) => [...root.querySelectorAll('tbody tr')].map((tr) => tr.getAttribute('aria-selected'));

describe('row selection (D6)', () => {
  it('gives every body row aria-selected as the string "false" by default', () => {
    const { root } = setup();
    expect(rowSelected(root)).toEqual(Array(10).fill('false'));
    expect(root.querySelectorAll('thead [aria-selected]')).toHaveLength(0);
  });

  it('Space toggles the row on and off and prevents page scrolling', () => {
    const { root } = setup();
    byId('data-grid-r2-c1').focus();
    expect(press(' ').defaultPrevented).toBe(true);
    expect(rowSelected(root)[1]).toBe('true');
    press(' ');
    expect(rowSelected(root)[1]).toBe('false');
  });

  it('Space keeps focus on the same cell after the re-render', () => {
    setup();
    byId('data-grid-r2-c1').focus();
    press(' ');
    expect(document.activeElement.id).toBe('data-grid-r2-c1');
  });

  it('Space can select several rows (multi-select)', () => {
    const { root } = setup();
    byId('data-grid-r1-c0').focus();
    press(' ');
    press('ArrowDown');
    press('ArrowDown');
    press(' ');
    expect(rowSelected(root).filter((value) => value === 'true')).toHaveLength(2);
    expect(rowSelected(root)[0]).toBe('true');
    expect(rowSelected(root)[2]).toBe('true');
  });

  it('Enter selects only that row and calls onRowSelect with the item', () => {
    const picked = [];
    const { root } = setup({ onRowSelect: (item) => picked.push(item) });
    byId('data-grid-r1-c0').focus();
    press(' ');
    press('ArrowDown');
    press('ArrowDown');
    press('Enter');
    expect(picked).toEqual([EMPLOYEES[2]]);
    expect(rowSelected(root).map((v) => v === 'true')).toEqual([false, false, true, ...Array(7).fill(false)]);
  });

  it('Enter prevents default and works without an onRowSelect callback', () => {
    setup();
    byId('data-grid-r1-c0').focus();
    expect(() => press('Enter')).not.toThrow();
    expect(press('Enter').defaultPrevented).toBe(true);
  });

  it('passes the right item after sorting (not data[0] of the original order)', () => {
    const picked = [];
    const { root } = setup({ onRowSelect: (item) => picked.push(item) });
    sortButton(root, 'Salary').click();
    byId('data-grid-r1-c0').focus();
    press('Enter');
    const lowest = Math.min(...EMPLOYEES.map((e) => e.salary));
    expect(picked).toHaveLength(1);
    expect(picked[0].salary).toBe(lowest);
  });

  it('passes the right item from another page', () => {
    const picked = [];
    setup({ onRowSelect: (item) => picked.push(item) });
    byId('data-grid-page-3').click();
    byId('data-grid-r1-c0').focus();
    press('Enter');
    expect(picked).toEqual([EMPLOYEES[20]]);
  });

  it('keeps the selected row selected after sorting, because selection tracks the original index', () => {
    const data = [
      { name: 'Cara', department: 'a', salary: 30 },
      { name: 'Ann', department: 'b', salary: 10 },
      { name: 'Bob', department: 'c', salary: 20 },
    ];
    const { root } = setup({ data });
    byId('data-grid-r1-c0').focus();
    press(' '); // chọn Cara
    sortButton(root, 'Name').click(); // Ann, Bob, Cara
    const selectedNames = [...root.querySelectorAll('tbody tr[aria-selected="true"] td:first-child')].map((td) => td.textContent);
    expect(selectedNames).toEqual(['Cara']);
  });

  it('keeps a selection made on another page after paging back', () => {
    const { root } = setup();
    byId('data-grid-page-2').click();
    byId('data-grid-r1-c0').focus();
    press(' ');
    byId('data-grid-page-1').click();
    expect(rowSelected(root)).toEqual(Array(10).fill('false'));
    byId('data-grid-page-2').click();
    expect(rowSelected(root)[0]).toBe('true');
  });

  it('does not select on Space or Enter inside a header button (they keep their native click)', () => {
    const { root } = setup();
    byId('data-grid-r0-c0').focus();
    expect(press(' ').defaultPrevented).toBe(false);
    expect(press('Enter').defaultPrevented).toBe(false);
    expect(rowSelected(root)).toEqual(Array(10).fill('false'));
  });

  it('does not select anything on a non-sortable header cell either', () => {
    const { root } = setup();
    byId('data-grid-r0-c1').focus();
    press('Enter');
    press(' ');
    expect(rowSelected(root)).toEqual(Array(10).fill('false'));
  });

  it('announces the number of selected rows', () => {
    const { status } = setup();
    byId('data-grid-r1-c0').focus();
    press(' ');
    expect(status.textContent).toBe('1 row selected');
    press('ArrowDown');
    press(' ');
    expect(status.textContent).toBe('2 rows selected');
    press('Enter');
    expect(status.textContent).toBe('1 row selected');
  });

  it('ignores Enter or Space with Alt held', () => {
    const { root } = setup();
    byId('data-grid-r1-c0').focus();
    press(' ', { altKey: true });
    expect(rowSelected(root)).toEqual(Array(10).fill('false'));
  });

  it('only ever uses the strings "true" and "false" for aria-selected', () => {
    const { root } = setup();
    byId('data-grid-r1-c0').focus();
    press(' ');
    const values = new Set(rowSelected(root));
    expect([...values].sort()).toEqual(['false', 'true']);
  });
});
