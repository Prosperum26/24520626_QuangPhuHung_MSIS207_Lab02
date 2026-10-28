import { readFileSync, readdirSync, statSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Vitest chạy từ gốc repo (như main.test.js của Homework 1).
const read = (file) => readFileSync(`Homework2_Lab02/${file}`, 'utf8');
const html = read('index.html');
const css = read('style.css');

function parsePage() {
  return new DOMParser().parseFromString(html, 'text/html');
}

/** Mọi file .js không phải test trong Homework2_Lab02 (trừ node_modules, evidence). */
function sourceFiles(dir = 'Homework2_Lab02') {
  return readdirSync(dir).flatMap((name) => {
    const path = `${dir}/${name}`;
    if (statSync(path).isDirectory()) return name === 'evidence' ? [] : sourceFiles(path);
    return path.endsWith('.js') && !path.endsWith('.test.js') ? [path] : [];
  });
}

describe('E1 index.html', () => {
  const page = parsePage();

  it('declares language, a meaningful title and one h1 inside main', () => {
    expect(page.documentElement.lang).toBe('en');
    expect(page.title).toBe('Audio Queue Visualizer');
    expect(page.querySelectorAll('h1')).toHaveLength(1);
    expect(page.querySelector('main h1')).not.toBeNull();
  });

  it('has a viewport meta without disabling zoom', () => {
    const viewport = page.querySelector('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toContain('width=device-width');
    expect(viewport).not.toMatch(/user-scalable\s*=\s*no|maximum-scale/);
  });

  it('keeps heading levels in order (h1, then h2 only)', () => {
    const levels = [...page.querySelectorAll('h1, h2, h3, h4')].map((h) => h.tagName);
    expect(levels[0]).toBe('H1');
    expect(levels.slice(1).every((tag) => tag === 'H2')).toBe(true);
  });

  it('labels every section by its heading', () => {
    for (const section of page.querySelectorAll('section')) {
      const heading = page.getElementById(section.getAttribute('aria-labelledby'));
      expect(heading, section.outerHTML.slice(0, 60)).not.toBeNull();
    }
  });

  it('gives the file input and the slider a visible label', () => {
    for (const id of ['file-input', 'volume']) {
      expect(page.querySelector(`label[for="${id}"]`), id).not.toBeNull();
      expect(page.getElementById(id)).not.toBeNull();
    }
  });

  it('accepts several audio files and mp4', () => {
    const input = page.getElementById('file-input');
    expect(input.multiple).toBe(true);
    expect(input.getAttribute('accept')).toContain('audio/*');
    expect(input.getAttribute('accept')).toContain('video/mp4');
  });

  it('has a status region outside every re-rendered list, announced politely', () => {
    const status = page.getElementById('status');
    expect(status.getAttribute('role')).toBe('status');
    expect(status.closest('ul')).toBeNull();
  });

  it('hides the decorative canvas from assistive technology', () => {
    expect(page.getElementById('visualizer').getAttribute('aria-hidden')).toBe('true');
  });

  it('uses real buttons (type=button) for every action and exposes the toggle state', () => {
    for (const button of page.querySelectorAll('button')) {
      expect(button.getAttribute('type'), button.textContent).toBe('button');
    }
    expect(page.querySelector('[data-action="toggle-effect"]').getAttribute('aria-pressed')).toBe('true');
  });

  it('has unique ids and no inline event handler', () => {
    const ids = [...page.querySelectorAll('[id]')].map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(html).not.toMatch(/\son[a-z]+\s*=/i);
  });

  it('loads the entry point as an ES module', () => {
    expect(page.querySelector('script[type="module"][src="./main.js"]')).not.toBeNull();
  });
});

describe('E1 style.css', () => {
  it('shows keyboard focus', () => {
    expect(css).toContain(':focus-visible');
  });

  it('respects reduced motion', () => {
    expect(css).toContain('prefers-reduced-motion: reduce');
  });

  it('makes controls at least 2.5rem (40px) tall, well over the 24px minimum', () => {
    expect(css).toMatch(/button,\s*input\s*{[^}]*min-height:\s*2\.5rem/);
  });

  it('does not rely on colour alone for the pressed toggle (adds a tick and bold)', () => {
    expect(css).toMatch(/button\[aria-pressed='true'\]::before/);
    expect(css).toMatch(/button\[aria-pressed='true'\]\s*{[^}]*font-weight:\s*700/);
  });

  it('lets long file names wrap instead of overflowing on a narrow screen', () => {
    expect(css).toMatch(/\.track-name\s*{[^}]*overflow-wrap:\s*anywhere/);
    expect(css).toMatch(/canvas\s*{[^}]*width:\s*100%/);
  });
});

describe('forbidden constructs (project rules)', () => {
  it.each(sourceFiles())('%s has none of the banned APIs', (file) => {
    const source = readFileSync(file, 'utf8');
    expect(source).not.toMatch(/\bvar\b/);
    expect(source).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML/);
    expect(source).not.toMatch(/keypress|keyCode/);
    expect(source).not.toMatch(/onclick\s*=/);
    expect(source).not.toMatch(/Math\.random|Date\.now/);
    expect(source).not.toMatch(/: any\b|<any>/);
  });
});

describe('E2 entry point', () => {
  let audioContextCreated;

  beforeEach(() => {
    vi.resetModules();
    audioContextCreated = 0;
    const parsed = parsePage();
    parsed.querySelectorAll('script').forEach((script) => script.remove());
    document.body.replaceChildren(...[...parsed.body.childNodes].map((node) => document.importNode(node, true)));

    // jsdom không có canvas, rAF, matchMedia và Web Audio.
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ clearRect() {}, fillRect() {}, fillStyle: '' }));
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} })));
    window.matchMedia = globalThis.matchMedia;
    vi.stubGlobal('AudioContext', class {
      constructor() { audioContextCreated += 1; throw new Error('AudioContext must not be created on load'); }
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts without creating an AudioContext or throwing', async () => {
    await expect(import('./main.js')).resolves.toBeDefined();
    expect(audioContextCreated).toBe(0);
  });

  it('renders the empty lists and an idle player', async () => {
    await import('./main.js');
    expect(document.querySelector('#queue-list .empty').textContent).toBe('No tracks waiting.');
    expect(document.querySelector('#ready-list .empty').textContent).toBe('No tracks ready yet.');
    expect(document.getElementById('now-playing').textContent).toBe('Nothing is playing.');
  });

  it('does not write to the live region on load (it would be announced before the user did anything)', async () => {
    await import('./main.js');
    expect(document.getElementById('status').textContent).toBe('');
  });

  it('creates the AudioContext only when the user adds a file', async () => {
    await import('./main.js');
    const input = document.getElementById('file-input');
    Object.defineProperty(input, 'files', { configurable: true, value: [new File(['x'], 'a.mp3')] });
    URL.createObjectURL = vi.fn(() => 'blob:a');
    URL.revokeObjectURL = vi.fn();

    // jsdom báo ngoại lệ của listener qua sự kiện 'error' của window thay vì ném ra khỏi dispatchEvent.
    // AudioContext giả cố tình ném, nên ngoại lệ đó chính là bằng chứng nó đã được tạo.
    const reported = [];
    const onError = (event) => { reported.push(event.error?.message); event.preventDefault(); };
    window.addEventListener('error', onError);
    input.dispatchEvent(new Event('change', { bubbles: true }));
    window.removeEventListener('error', onError);

    expect(audioContextCreated).toBe(1);
    expect(reported).toEqual(['AudioContext must not be created on load']);
  });
});
