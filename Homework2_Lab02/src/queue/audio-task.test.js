import { describe, expect, it } from 'vitest';
import { TASK_STATUS, createAbortError, isAbortError, isTerminal } from './audio-task.js';

describe('audio task contract (A1)', () => {
  it('freezes the status table', () => {
    expect(Object.isFrozen(TASK_STATUS)).toBe(true);
  });

  it('has exactly the six statuses of the contract', () => {
    expect(Object.values(TASK_STATUS).sort()).toEqual(
      ['cancelled', 'decoding', 'error', 'loading', 'queued', 'ready'],
    );
  });

  it('treats ready, cancelled and error as terminal', () => {
    expect(isTerminal(TASK_STATUS.READY)).toBe(true);
    expect(isTerminal(TASK_STATUS.CANCELLED)).toBe(true);
    expect(isTerminal(TASK_STATUS.ERROR)).toBe(true);
  });

  it('treats queued, loading and decoding as not terminal', () => {
    expect(isTerminal(TASK_STATUS.QUEUED)).toBe(false);
    expect(isTerminal(TASK_STATUS.LOADING)).toBe(false);
    expect(isTerminal(TASK_STATUS.DECODING)).toBe(false);
  });

  it('creates an error named AbortError', () => {
    const error = createAbortError();
    expect(error.name).toBe('AbortError');
    expect(error.message).not.toBe('');
  });

  it('recognises the error that fetch rejects with on abort', () => {
    const controller = new AbortController();
    controller.abort();
    expect(isAbortError(controller.signal.reason)).toBe(true);
    expect(isAbortError(createAbortError())).toBe(true);
  });

  it('rejects ordinary errors and non-errors', () => {
    expect(isAbortError(new Error('x'))).toBe(false);
    expect(isAbortError(new TypeError('Failed to fetch'))).toBe(false);
    expect(isAbortError(null)).toBe(false);
    expect(isAbortError(undefined)).toBe(false);
    expect(isAbortError('AbortError')).toBe(false);
  });
});
