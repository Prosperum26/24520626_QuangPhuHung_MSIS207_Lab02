import { readFileSync, readdirSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = 'Homework3_Lab02';
const html = readFileSync(`${root}/index.html`, 'utf8');
const css = readFileSync(`${root}/style.css`, 'utf8');
const doc = new DOMParser().parseFromString(html, 'text/html');

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = `${dir}/${name}`;
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return name.endsWith('.js') && !name.endsWith('.test.js') ? [path] : [];
  });
}

describe('E1 index.html', () => {
  it('has lang, title, viewport, one h1 and a main landmark', () => {
    expect(doc.documentElement.lang).toBe('vi');
    expect(doc.title.length).toBeGreaterThan(0);
    expect(doc.querySelector('meta[name="viewport"]')).not.toBeNull();
    expect(doc.querySelectorAll('h1')).toHaveLength(1);
    expect(doc.querySelectorAll('main')).toHaveLength(1);
  });

  it('every button is type=button with a name and no inline handler', () => {
    const buttons = [...doc.querySelectorAll('button')];
    expect(buttons.length).toBeGreaterThan(0);
    for (const b of buttons) {
      expect(b.getAttribute('type')).toBe('button');
      expect(b.textContent.trim().length).toBeGreaterThan(0);
    }
    expect(doc.querySelectorAll('[onclick], [onkeydown], [onchange]')).toHaveLength(0);
  });

  it('has a polite status region and an alert region, and none on the clocks', () => {
    expect(doc.querySelector('#status[role="status"]')).not.toBeNull();
    expect(doc.querySelector('#alert[role="alert"]')).not.toBeNull();
    for (const time of doc.querySelectorAll('time')) expect(time.hasAttribute('aria-live')).toBe(false);
  });

  it('marks the skip link target', () => {
    expect(doc.querySelector('a.skip-link[href="#main"]')).not.toBeNull();
    expect(doc.getElementById('main')).not.toBeNull();
  });
});

describe('E1 style.css', () => {
  it('hides milliseconds under prefers-reduced-motion', () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*{[^}]*\.ms\s*{\s*display:\s*none/);
  });

  it('has a visible focus style and a 24px minimum target', () => {
    expect(css).toContain(':focus-visible');
    expect(css).toMatch(/min-height:\s*44px/);
    expect(css).toMatch(/min-width:\s*24px/);
  });
});

describe('project rules in HW3 source', () => {
  const files = sourceFiles(`${root}/src`).concat(`${root}/main.js`);

  it.each(files.map((f) => [f]))('%s avoids banned APIs', (file) => {
    const code = readFileSync(file, 'utf8');
    expect(code).not.toMatch(/\binnerHTML\b|\bouterHTML\b|insertAdjacentHTML/);
    expect(code).not.toMatch(/\bvar\s/);
    expect(code).not.toMatch(/\bsetInterval\b/);
    expect(code).not.toMatch(/keypress|keyCode/);
    expect(code.startsWith('// @ts-check')).toBe(true);
  });
});
