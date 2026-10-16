import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from './mini-react.js';
import {
  claimSlot,
  cursor,
  renderApp,
  resetCursor,
  setRenderer,
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
