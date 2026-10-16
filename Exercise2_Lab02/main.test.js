import { describe, expect, it } from 'vitest';

describe('main.js (D7)', () => {
  it('gắn hub rồi render app vào #app', async () => {
    const main = document.createElement('main');
    const app = document.createElement('div');
    app.id = 'app';
    const status = document.createElement('p');
    status.id = 'status';
    main.append(app, status);
    document.body.replaceChildren(main);

    await import('./main.js');
    expect(app.querySelector('h1').textContent).toBe('Task Manager');

    app.querySelector('#toggle-seed-1').click();
    expect(app.querySelector('li').textContent).toContain('Completed');
    expect(status.textContent).toBe('Marked done: Review PR');
  });
});
