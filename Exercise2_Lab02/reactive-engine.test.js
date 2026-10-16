import { beforeEach, describe, expect, it } from 'vitest';
import { claimSlot, cursor, resetCursor, stateStore } from './reactive-engine.js';

beforeEach(() => {
  stateStore.length = 0;
  resetCursor();
});

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
