import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('main.js (D1)', () => {
  it('mounts DataFeed in IDLE and wires the delegation hub', async () => {
    const main = document.createElement('main');
    const app = document.createElement('div');
    app.id = 'app';
    const status = document.createElement('p');
    status.id = 'status';
    main.append(app, status);
    document.body.replaceChildren(main);

    await import('./main.js');
    expect(app.querySelector('h1').textContent).toBe('Data Feed');
    expect(app.textContent).toContain('Press Load feed to start.');

    app.querySelector('#load-feed').click();
    expect(app.querySelector('.skeleton')).not.toBeNull();
    expect(status.textContent).toBe('Loading feed');
  });
});

describe('style.css (D1)', () => {
  const css = readFileSync('Exercise3_Lab02/style.css', 'utf8') /* cwd là gốc repo khi chạy npm test */;

  it('pulses the skeleton with keyframes', () => {
    expect(css).toMatch(/@keyframes\s+pulse/);
    expect(css).toMatch(/\.skeleton[^{]*\{[^}]*animation:/s);
  });

  it('turns the animation off under prefers-reduced-motion', () => {
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[^}]*animation:\s*none/s);
  });

  it('keeps a visible focus style and a minimum target size', () => {
    expect(css).toContain(':focus-visible');
    expect(css).toMatch(/min-height:\s*2\.5rem/);
  });
});
