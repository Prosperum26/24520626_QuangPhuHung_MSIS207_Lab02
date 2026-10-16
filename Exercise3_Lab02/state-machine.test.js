import { describe, expect, it } from 'vitest';
import { STATUS, initialState } from './state-machine.js';

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
