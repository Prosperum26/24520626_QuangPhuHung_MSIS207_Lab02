import { describe, expect, it } from 'vitest';
import { TEXT_ELEMENT, createElement, createTextElement } from './mini-react.js';

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
