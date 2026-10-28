import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement, renderToDOM } from './mini-react.js';
import {
  claimSlot,
  cursor,
  findHandler,
  handlerPropOf,
  renderApp,
  resetCursor,
  setRenderer,
  setupEventDelegation,
  stateStore,
  useState,
} from './reactive-engine.js';

beforeEach(() => {
  stateStore.length = 0;
  resetCursor();
  setRenderer(null);
});

/** Mô phỏng một lần render: cursor về 0 rồi chạy component. */
function render(component) {
  resetCursor();
  return component();
}

describe('resetCursor', () => {
  it('đưa cursor về 0 sau khi đã tăng', () => {
    claimSlot('a');
    claimSlot('b');
    expect(cursor).toBe(2);
    resetCursor();
    expect(cursor).toBe(0);
  });

  it('không xoá stateStore', () => {
    claimSlot('a');
    claimSlot('b');
    resetCursor();
    expect(stateStore).toEqual(['a', 'b']);
  });
});

describe('claimSlot', () => {
  it('lần gọi đầu khởi tạo ô, trả đúng chỉ số và tăng cursor', () => {
    expect(claimSlot('x')).toBe(0);
    expect(claimSlot('y')).toBe(1);
    expect(stateStore).toEqual(['x', 'y']);
    expect(cursor).toBe(2);
  });

  it('render lần sau (sau resetCursor) giữ giá trị cũ, bỏ qua initialValue mới', () => {
    claimSlot('x');
    resetCursor();
    expect(claimSlot('khác')).toBe(0);
    expect(stateStore).toEqual(['x']);
  });

  it('giữ nguyên null, không khởi tạo lại', () => {
    claimSlot(null);
    resetCursor();
    claimSlot('khác');
    expect(stateStore).toEqual([null]);
  });

  it('giữ nguyên undefined, không khởi tạo lại và không đẩy thêm ô', () => {
    claimSlot(undefined);
    resetCursor();
    claimSlot('khác');
    expect(stateStore).toHaveLength(1);
    expect(stateStore[0]).toBeUndefined();
  });

  it('chỉ khởi tạo ô mới khi cursor chạm độ dài mảng', () => {
    claimSlot('a');
    resetCursor();
    claimSlot('a2');
    claimSlot('b');
    expect(stateStore).toEqual(['a', 'b']);
  });
});

describe('useState (B1: đọc giá trị)', () => {
  it('trả giá trị đầu ở lần render đầu', () => {
    const [value] = render(() => useState(7));
    expect(value).toBe(7);
  });

  it('giữ giá trị qua nhiều lần render, bỏ qua initialValue mới', () => {
    const [, setValue] = render(() => useState(1));
    setValue(2);
    const [value] = render(() => useState(999));
    expect(value).toBe(2);
  });

  it('hai hook trả đúng giá trị theo thứ tự gọi', () => {
    const component = () => [useState('a'), useState('b')];
    const [[, setA]] = render(component);
    setA('a2');
    const [[a], [b]] = render(component);
    expect([a, b]).toEqual(['a2', 'b']);
  });
});

describe('setter (B2: closure trên index)', () => {
  it('ghi đúng ô dù cursor đã đổi khi setter chạy', () => {
    const [[, setFirst]] = render(() => [useState('x'), useState('y')]);
    expect(cursor).toBe(2);
    setFirst('x2');
    expect(stateStore).toEqual(['x2', 'y']);
  });
});

describe('setter (B3: updater function)', () => {
  it('setCount(c => c + 1) hai lần cộng dồn', () => {
    const component = () => useState(0);
    const [, setCount] = render(component);
    setCount((c) => c + 1);
    setCount((c) => c + 1);
    const [count] = render(component);
    expect(count).toBe(2);
  });

  it('nhận giá trị trực tiếp, kể cả chuỗi rỗng', () => {
    const component = () => useState('a');
    const [, setValue] = render(component);
    setValue('');
    expect(render(component)[0]).toBe('');
  });
});

describe('setter (B4: bỏ qua khi không đổi)', () => {
  it('cùng giá trị thì không render, khác giá trị thì render đúng một lần', () => {
    const renderer = vi.fn();
    setRenderer(renderer);
    const [, setValue] = render(() => useState(1));
    setValue(1);
    expect(renderer).toHaveBeenCalledTimes(0);
    setValue(2);
    expect(renderer).toHaveBeenCalledTimes(1);
  });

  it('NaN với NaN coi là không đổi', () => {
    const renderer = vi.fn();
    setRenderer(renderer);
    const [, setValue] = render(() => useState(NaN));
    setValue(NaN);
    expect(renderer).not.toHaveBeenCalled();
  });

  it('updater trả về chính prev thì cũng không render', () => {
    const renderer = vi.fn();
    setRenderer(renderer);
    const [, setValue] = render(() => useState(5));
    setValue((prev) => prev);
    expect(renderer).not.toHaveBeenCalled();
  });

  it('state vẫn đổi được khi chưa có renderer', () => {
    const [, setValue] = render(() => useState(1));
    setValue(2);
    expect(stateStore).toEqual([2]);
  });
});

describe('renderApp (B5)', () => {
  it('dựng DOM lần đầu vào container', () => {
    const container = document.createElement('div');
    const Counter = () => {
      const [count] = useState(3);
      return createElement('p', null, `Count: ${count}`);
    };
    renderApp(Counter, container);
    expect(container.innerHTML).toBe('<p>Count: 3</p>');
  });

  it('gọi setter thì DOM cập nhật, không nhân đôi nội dung', () => {
    const container = document.createElement('div');
    let setCount;
    const Counter = () => {
      const [count, set] = useState(0);
      setCount = set;
      return createElement('p', null, `Count: ${count}`);
    };
    renderApp(Counter, container);
    setCount((c) => c + 1);
    setCount((c) => c + 1);
    expect(container.innerHTML).toBe('<p>Count: 2</p>');
    expect(container.children).toHaveLength(1);
  });

  it('cursor được reset mỗi lần render nên stateStore không phình ra', () => {
    const container = document.createElement('div');
    let setA;
    const App = () => {
      const [a, set] = useState(0);
      setA = set;
      const [b] = useState('b');
      return createElement('p', null, `${a}${b}`);
    };
    renderApp(App, container);
    setA(1);
    setA(2);
    expect(stateStore).toEqual([2, 'b']);
    expect(container.textContent).toBe('2b');
  });
});

describe('Quy tắc Hooks (B6: tài liệu hoá lỗi, không cố ngăn)', () => {
  it('hook trong if làm lệch cursor: age nhận nhầm giá trị của tier', () => {
    let showTier = true;
    const BuggyProfile = () => {
      const [name] = useState('Khiem');
      const tier = showTier ? useState('Platinum')[0] : null;
      const [age] = useState(28);
      return { name, tier, age };
    };

    expect(render(BuggyProfile)).toEqual({ name: 'Khiem', tier: 'Platinum', age: 28 });

    showTier = false;
    expect(render(BuggyProfile).age).toBe('Platinum');
  });
});

/** Dựng cây vào một root mới, đã gắn hub. */
function mountWithHub(vNode) {
  const root = document.createElement('div');
  document.body.append(root);
  setupEventDelegation(root);
  root.replaceChildren(renderToDOM(vNode));
  return root;
}

describe('handlerPropOf / findHandler (C3)', () => {
  it('ánh xạ click, input, keydown sang tên prop; loại khác là undefined', () => {
    expect(handlerPropOf('click')).toBe('onClick');
    expect(handlerPropOf('input')).toBe('onInput');
    expect(handlerPropOf('keydown')).toBe('onKeydown');
    expect(handlerPropOf('keypress')).toBeUndefined();
    expect(handlerPropOf('constructor')).toBeUndefined();
  });

  it('click vào <span> bên trong <button> vẫn tìm ra onClick của button', () => {
    const onClick = () => {};
    const root = mountWithHub(
      createElement('main', null, createElement('button', { onClick }, createElement('span', null, 'Add'))),
    );
    const span = root.querySelector('span');
    expect(findHandler(span, root, 'click')).toBe(onClick);
  });

  it('handler gần target nhất thắng handler của tổ tiên', () => {
    const inner = () => {};
    const outer = () => {};
    const root = mountWithHub(
      createElement('section', { onClick: outer }, createElement('button', { onClick: inner }, 'x')),
    );
    expect(findHandler(root.querySelector('button'), root, 'click')).toBe(inner);
  });

  it('không có handler trên đường đi thì trả null', () => {
    const root = mountWithHub(createElement('main', null, createElement('p', null, 'x')));
    expect(findHandler(root.querySelector('p'), root, 'click')).toBeNull();
  });

  it('dừng ở root: handler nằm ngoài root không bao giờ được tìm thấy', () => {
    const outside = document.createElement('section');
    outside._vnode = createElement('section', { onClick: () => {} });
    const root = document.createElement('div');
    outside.append(root);
    const p = document.createElement('p');
    root.append(p);
    expect(findHandler(p, root, 'click')).toBeNull();
  });

  it('prop on* không phải hàm bị bỏ qua, đi tiếp lên tổ tiên', () => {
    const outer = () => {};
    const root = mountWithHub(
      createElement('section', { onClick: outer }, createElement('button', { onClick: 'alert(1)' }, 'x')),
    );
    expect(findHandler(root.querySelector('button'), root, 'click')).toBe(outer);
  });

  it('target không phải Element (null, text node) thì trả null', () => {
    const root = mountWithHub(createElement('p', null, 'x'));
    expect(findHandler(null, root, 'click')).toBeNull();
    expect(findHandler(root.querySelector('p').firstChild, root, 'click')).toBeNull();
  });
});

describe('setupEventDelegation (C4)', () => {
  it('đúng 3 addEventListener trên root: click, input, keydown', () => {
    const root = document.createElement('div');
    const spy = vi.spyOn(root, 'addEventListener');
    setupEventDelegation(root);
    expect(spy.mock.calls.map(([type]) => type)).toEqual(['click', 'input', 'keydown']);
  });

  it('gọi setup lần hai trên cùng root không thêm listener', () => {
    const root = document.createElement('div');
    const spy = vi.spyOn(root, 'addEventListener');
    setupEventDelegation(root);
    setupEventDelegation(root);
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it('click vào con gọi onClick đúng một lần và truyền event', () => {
    const onClick = vi.fn();
    const root = mountWithHub(createElement('button', { onClick }, createElement('span', null, 'Add')));
    root.querySelector('span').click();
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick.mock.calls[0][0]).toBeInstanceOf(Event);
  });

  it('chỉ handler của nút được bấm chạy, nút anh em thì không', () => {
    const a = vi.fn();
    const b = vi.fn();
    const root = mountWithHub(
      createElement(
        'main',
        null,
        createElement('button', { onClick: a }, 'a'),
        createElement('button', { onClick: b }, 'b'),
      ),
    );
    root.querySelectorAll('button')[1].click();
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('input event tới onInput', () => {
    const onInput = vi.fn();
    const root = mountWithHub(createElement('input', { onInput }));
    root.querySelector('input').dispatchEvent(new Event('input', { bubbles: true }));
    expect(onInput).toHaveBeenCalledTimes(1);
  });

  it('click lên vùng không có handler không ném lỗi', () => {
    const root = mountWithHub(createElement('p', null, 'x'));
    expect(() => root.querySelector('p').click()).not.toThrow();
  });

  it('event ngoài danh sách (vd. focus) không gọi gì', () => {
    const onFocus = vi.fn();
    const root = mountWithHub(createElement('button', { onFocus }, 'x'));
    root.querySelector('button').dispatchEvent(new Event('focus', { bubbles: true }));
    expect(onFocus).not.toHaveBeenCalled();
  });
});

describe('Bàn phím (C5)', () => {
  it('keydown với e.key === "Enter" tới onKeydown', () => {
    const onKeydown = vi.fn();
    const root = mountWithHub(createElement('input', { onKeydown }));
    root
      .querySelector('input')
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(onKeydown).toHaveBeenCalledTimes(1);
    expect(onKeydown.mock.calls[0][0].key).toBe('Enter');
  });
});

describe('Không có listener mồ côi (C6)', () => {
  it('mount 3 nút + hub: mọi addEventListener đều gắn lên root, kể cả sau khi re-render', () => {
    const spy = vi.spyOn(EventTarget.prototype, 'addEventListener');
    const root = document.createElement('div');
    setupEventDelegation(root);

    let setCount;
    const App = () => {
      const [count, set] = useState(0);
      setCount = set;
      return createElement(
        'main',
        null,
        createElement('p', null, `n=${count}`),
        createElement('button', { onClick: () => {} }, 'one'),
        createElement('button', { onClick: () => {} }, 'two'),
        createElement('button', { onClick: () => {} }, 'three'),
      );
    };
    renderApp(App, root);
    setCount(1);
    setCount(2);

    const targets = [...spy.mock.contexts];
    spy.mockRestore();
    expect(root.querySelectorAll('button')).toHaveLength(3);
    expect(targets).toHaveLength(3);
    expect(targets.every((target) => target === root)).toBe(true);
  });

  it('luồng đầy đủ: click -> hub -> handler -> setter -> re-render -> DOM', () => {
    const root = document.createElement('div');
    setupEventDelegation(root);
    const App = () => {
      const [count, setCount] = useState(0);
      return createElement(
        'main',
        null,
        createElement('p', null, `n=${count}`),
        createElement('button', { onClick: () => setCount((c) => c + 1) }, 'inc'),
      );
    };
    renderApp(App, root);
    root.querySelector('button').click();
    root.querySelector('button').click();
    expect(root.querySelector('p').textContent).toBe('n=2');
  });
});
