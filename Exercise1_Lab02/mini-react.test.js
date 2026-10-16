import { describe, expect, it, vi } from 'vitest';
import { TEXT_ELEMENT, createElement, createTextElement, renderToDOM } from './mini-react.js';

describe('createTextElement', () => {
  it('bọc chuỗi thành VNode TEXT_ELEMENT', () => {
    const node = createTextElement('xin chào');
    expect(node.type).toBe(TEXT_ELEMENT);
    expect(node.props.nodeValue).toBe('xin chào');
    expect(node.props.children).toEqual([]);
  });

  it('ép số thành chuỗi, kể cả 0', () => {
    expect(createTextElement(0).props.nodeValue).toBe('0');
    expect(createTextElement(42).props.nodeValue).toBe('42');
  });

  it('trả object bất biến (VNode, props, children)', () => {
    const node = createTextElement('a');
    expect(Object.isFrozen(node)).toBe(true);
    expect(Object.isFrozen(node.props)).toBe(true);
    expect(Object.isFrozen(node.props.children)).toBe(true);
  });
});

describe('createElement', () => {
  it('giữ type và copy props', () => {
    const node = createElement('main', { id: 'root-view' });
    expect(node.type).toBe('main');
    expect(node.props.id).toBe('root-view');
    expect(node.props.children).toEqual([]);
  });

  it('props null hoặc undefined thành object rỗng có children', () => {
    expect(createElement('p', null).props).toEqual({ children: [] });
    expect(createElement('p', undefined).props).toEqual({ children: [] });
  });

  it('bọc string và number thành TEXT_ELEMENT', () => {
    const { children } = createElement('p', null, 'a', 7).props;
    expect(children.map((c) => c.type)).toEqual([TEXT_ELEMENT, TEXT_ELEMENT]);
    expect(children.map((c) => c.props.nodeValue)).toEqual(['a', '7']);
  });

  it('không lọc nhầm số 0 và chuỗi rỗng', () => {
    const { children } = createElement('p', null, 0, '').props;
    expect(children).toHaveLength(2);
  });

  it('lọc null, undefined, false, true', () => {
    const { children } = createElement('p', null, null, undefined, false, true, 'giữ').props;
    expect(children).toHaveLength(1);
    expect(children[0].props.nodeValue).toBe('giữ');
  });

  it('flatten children lồng nhau nhiều cấp', () => {
    const { children } = createElement('ul', null, ['a', ['b', [['c']]]]).props;
    expect(children.map((c) => c.props.nodeValue)).toEqual(['a', 'b', 'c']);
  });

  it('giữ nguyên VNode con, không bọc lại', () => {
    const child = createElement('span', null, 'x');
    const parent = createElement('p', null, child);
    expect(parent.props.children[0]).toBe(child);
  });

  it('children truyền qua đối số ghi đè props.children', () => {
    const node = createElement('p', { children: ['bỏ'] }, 'giữ');
    expect(node.props.children).toHaveLength(1);
    expect(node.props.children[0].props.nodeValue).toBe('giữ');
  });

  it('không sửa object props của người gọi', () => {
    const props = { id: 'a' };
    createElement('p', props, 'x');
    expect(props).toEqual({ id: 'a' });
  });

  it('trả object bất biến (VNode, props, children)', () => {
    const node = createElement('p', { id: 'a' }, 'x');
    expect(Object.isFrozen(node)).toBe(true);
    expect(Object.isFrozen(node.props)).toBe(true);
    expect(Object.isFrozen(node.props.children)).toBe(true);
  });

  it('nhận function component làm type', () => {
    const Card = () => createElement('article', null);
    expect(createElement(Card, { title: 't' }).type).toBe(Card);
  });

  it('giữ key trong props', () => {
    expect(createElement('li', { key: 'task-1' }).props.key).toBe('task-1');
  });

  it('chuỗi HTML nguy hiểm vẫn chỉ là nodeValue (chưa thành element)', () => {
    const { children } = createElement('p', null, '<img onerror=alert(1)>').props;
    expect(children[0].type).toBe(TEXT_ELEMENT);
    expect(children[0].props.nodeValue).toBe('<img onerror=alert(1)>');
  });
});

describe('renderToDOM', () => {
  it('TEXT_ELEMENT thành Text node', () => {
    const dom = renderToDOM(createTextElement('hi'));
    expect(dom.nodeType).toBe(Node.TEXT_NODE);
    expect(dom.nodeValue).toBe('hi');
  });

  it('tag thành Element đúng tên', () => {
    const dom = renderToDOM(createElement('section', null));
    expect(dom.nodeType).toBe(Node.ELEMENT_NODE);
    expect(dom.tagName).toBe('SECTION');
  });

  it('gán attribute, ánh xạ className thành class', () => {
    const dom = renderToDOM(createElement('header', { id: 'h', role: 'banner', className: 'hero' }));
    expect(dom.getAttribute('id')).toBe('h');
    expect(dom.getAttribute('role')).toBe('banner');
    expect(dom.getAttribute('class')).toBe('hero');
  });

  it('không rò children, nodeValue, key thành attribute', () => {
    const dom = renderToDOM(createElement('li', { key: 'k1' }, 'x'));
    expect(dom.getAttributeNames()).toEqual([]);
  });

  it('boolean prop: true thành attribute rỗng, false/null/undefined bị bỏ', () => {
    const dom = renderToDOM(
      createElement('button', { disabled: true, hidden: false, title: null, lang: undefined }),
    );
    expect(dom.getAttribute('disabled')).toBe('');
    expect(dom.getAttributeNames()).toEqual(['disabled']);
  });

  it('onClick gắn listener click, gọi đúng một lần', () => {
    const onClick = vi.fn();
    const dom = renderToDOM(createElement('button', { onClick }, 'Click'));
    dom.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('prop on* không phải hàm bị bỏ, không bao giờ thành inline handler', () => {
    const dom = renderToDOM(createElement('button', { onClick: 'alert(1)', onclick: 'alert(2)' }));
    expect(dom.getAttributeNames()).toEqual([]);
  });

  it('đệ quy children theo đúng thứ tự', () => {
    const dom = renderToDOM(
      createElement('ul', null, createElement('li', null, 'a'), createElement('li', null, 'b', 'c')),
    );
    expect(dom.outerHTML).toBe('<ul><li>a</li><li>bc</li></ul>');
  });

  it('function component được gọi với props kèm children', () => {
    const Card = vi.fn((props) => createElement('article', { className: props.tone }, props.children));
    const dom = renderToDOM(createElement(Card, { tone: 'info' }, createElement('h3', null, 'T')));
    expect(Card).toHaveBeenCalledTimes(1);
    expect(dom.outerHTML).toBe('<article class="info"><h3>T</h3></article>');
  });

  it('function component lồng function component', () => {
    const Inner = () => createElement('span', null, 'in');
    const Outer = () => createElement('p', null, createElement(Inner, null));
    expect(renderToDOM(createElement(Outer, null)).outerHTML).toBe('<p><span>in</span></p>');
  });

  it('XSS: chuỗi HTML làm child hiện như text, không tạo element', () => {
    const payload = '<img onerror=alert(1)> Safe Text';
    const dom = renderToDOM(createElement('p', null, payload));
    expect(dom.querySelector('img')).toBeNull();
    expect(dom.childNodes).toHaveLength(1);
    expect(dom.textContent).toBe(payload);
  });

  it('XSS: <script> làm child hiện như text, không tạo thẻ script', () => {
    const payload = '<script>alert(1)</script>';
    const dom = renderToDOM(createElement('main', null, payload));
    expect(dom.querySelector('script')).toBeNull();
    expect(dom.textContent).toBe(payload);
    expect(dom.innerHTML).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('typeguard: từ chối giá trị không phải VNode', () => {
    expect(() => renderToDOM(null)).toThrow(TypeError);
    expect(() => renderToDOM('chuỗi trần')).toThrow(TypeError);
    expect(() => renderToDOM({})).toThrow(TypeError);
  });

  it('typeguard: function component trả về không phải VNode thì báo lỗi', () => {
    const Bad = () => null;
    expect(() => renderToDOM(createElement(Bad, null))).toThrow(TypeError);
  });

  it('cây Checkpoint 1: mount vào container, không node mồ côi', () => {
    const vApp = createElement(
      'main',
      { id: 'root-view', role: 'main' },
      createElement(
        'header',
        { className: 'hero' },
        createElement('h1', null, 'Mini React Engine'),
        createElement('p', null, '<img onerror=alert(1)> Safe Text'),
      ),
      createElement('button', { onClick: () => {} }, 'Click'),
    );
    const root = document.createElement('div');
    root.replaceChildren(renderToDOM(vApp));

    expect(root.querySelector('button')).not.toBeNull();
    expect(root.querySelector('img')).toBeNull();
    expect(root.querySelectorAll('div')).toHaveLength(0);

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ALL);
    while (walker.nextNode()) {
      expect(root.contains(walker.currentNode)).toBe(true);
    }
  });
});
