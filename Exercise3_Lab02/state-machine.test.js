import { describe, expect, it } from 'vitest';
import { STATUS, initialState, transition } from './state-machine.js';

const items = [{ id: 'a', title: 'A', summary: 'a' }];
const loading = { status: 'LOADING' };
const success = { status: 'SUCCESS', data: items };
const error = { status: 'ERROR', error: 'Network down' };

describe('contract (A1)', () => {
  it('has exactly four statuses', () => {
    expect(Object.values(STATUS)).toEqual(['IDLE', 'LOADING', 'SUCCESS', 'ERROR']);
  });

  it('freezes STATUS and initialState', () => {
    expect(Object.isFrozen(STATUS)).toBe(true);
    expect(Object.isFrozen(initialState)).toBe(true);
  });

  it('starts in IDLE', () => {
    expect(initialState).toEqual({ status: 'IDLE' });
  });
});

describe('transition, valid paths (A2)', () => {
  it('IDLE + LOAD -> LOADING', () => {
    expect(transition(initialState, { type: 'LOAD' })).toEqual({ status: 'LOADING' });
  });

  it('LOADING + RESOLVE -> SUCCESS with the event data', () => {
    expect(transition(loading, { type: 'RESOLVE', data: items })).toEqual({ status: 'SUCCESS', data: items });
  });

  it('LOADING + REJECT -> ERROR with the event error', () => {
    expect(transition(loading, { type: 'REJECT', error: 'Network down' })).toEqual(error);
  });

  it('SUCCESS + LOAD -> LOADING and drops the old data', () => {
    expect(transition(success, { type: 'LOAD' })).toEqual({ status: 'LOADING' });
  });

  it('ERROR + LOAD -> LOADING (Retry goes through LOADING) and drops the old error', () => {
    expect(transition(error, { type: 'LOAD' })).toEqual({ status: 'LOADING' });
  });

  it('LOADING + LOAD -> LOADING (a newer request starts)', () => {
    expect(transition(loading, { type: 'LOAD' })).toEqual({ status: 'LOADING' });
  });

  it('returns frozen states', () => {
    expect(Object.isFrozen(transition(loading, { type: 'RESOLVE', data: items }))).toBe(true);
    expect(Object.isFrozen(transition(loading, { type: 'REJECT', error: 'x' }))).toBe(true);
    expect(Object.isFrozen(transition(initialState, { type: 'LOAD' }))).toBe(true);
  });
});
