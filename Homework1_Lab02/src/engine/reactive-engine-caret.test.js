import { beforeEach, describe, expect, it } from 'vitest';
import { createElement } from './mini-react.js';
import { renderApp, resetCursor, setRenderer, setupEventDelegation, stateStore, useState } from './reactive-engine.js';

beforeEach(() => {
  stateStore.length = 0;
  resetCursor();
  setRenderer(null);
});

/** Ô nhập điều khiển bằng state, giống ô lọc của grid. */
function setup(inputType = 'search', initial = 'hello') {
  document.body.replaceChildren();
  const root = document.createElement('div');
  document.body.append(root);
  setupEventDelegation(root);

  function App() {
    const [text, setText] = useState(initial);
    return createElement(
      'div',
      null,
      createElement('input', {
        id: 'box',
        type: inputType,
        value: text,
        onInput: (event) => setText(event.target.value),
      }),
      createElement('button', { id: 'other' }, 'other'),
      createElement('p', null, 'x'),
    );
  }
  renderApp(App, root);
  return root;
}

/** Giả lập người dùng gõ: đổi value, đặt caret, rồi bắn event `input` như trình duyệt. */
function type(input, value, caret) {
  input.value = value;
  // Input number không hỗ trợ selection: setSelectionRange ném InvalidStateError.
  if (input.selectionStart !== null) input.setSelectionRange(caret, caret);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('focus restore keeps the caret (C1)', () => {
  it('keeps focus and the caret in the middle of the text after a re-render', () => {
    const root = setup();
    root.querySelector('#box').focus();
    type(root.querySelector('#box'), 'helXlo', 4);

    const input = root.querySelector('#box');
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe('helXlo');
    expect(input.selectionStart).toBe(4);
    expect(input.selectionEnd).toBe(4);
  });

  it('keeps a selected range', () => {
    const root = setup();
    const first = root.querySelector('#box');
    first.focus();
    first.value = 'hello!';
    first.setSelectionRange(1, 3, 'backward');
    first.dispatchEvent(new Event('input', { bubbles: true }));

    const input = root.querySelector('#box');
    expect([input.selectionStart, input.selectionEnd]).toEqual([1, 3]);
  });

  it('lets typing continue in order after several renders (no reversed text)', () => {
    const root = setup('search', '');
    root.querySelector('#box').focus();
    let value = '';
    for (const char of 'abc') {
      const input = root.querySelector('#box');
      value = input.value + char;
      type(input, value, value.length);
    }
    expect(root.querySelector('#box').value).toBe('abc');
    expect(root.querySelector('#box').selectionStart).toBe(3);
  });

  it('works for an input type without selection support (number) without throwing', () => {
    const root = setup('number', '5');
    root.querySelector('#box').focus();
    expect(() => type(root.querySelector('#box'), '56', 2)).not.toThrow();
    expect(document.activeElement).toBe(root.querySelector('#box'));
  });

  it('restores focus on a non-input element without touching selection', () => {
    const root = setup();
    root.querySelector('#other').focus();
    root.querySelector('#box').dispatchEvent(new Event('input', { bubbles: true }));
    expect(document.activeElement).toBe(root.querySelector('#other'));
  });

  it('does nothing when the focused element has no id or is outside the container', () => {
    const root = setup();
    const outside = document.createElement('button');
    document.body.append(outside);
    outside.focus();
    root.querySelector('#box').dispatchEvent(new Event('input', { bubbles: true }));
    expect(document.activeElement).toBe(outside);
  });
});
