import { describe, expect, it } from 'vitest';
import { errorMessageOf } from './feed-loader.js';

describe('errorMessageOf (B4)', () => {
  it('reads message from an Error', () => {
    expect(errorMessageOf(new Error('Network down'))).toBe('Network down');
  });

  it('accepts a plain string', () => {
    expect(errorMessageOf('boom')).toBe('boom');
  });

  it.each([undefined, null, 42, { message: 'fake' }, new Error(''), ''])('falls back for %j', (value) => {
    expect(errorMessageOf(value)).toBe('Unknown error');
  });
});
