import { describe, it, expect } from 'vitest';
import { isUnreachable } from './serverErrors';

describe('isUnreachable', () => {
  it.each([
    [{ message: 'fetch failed' }],
    [{ message: 'TypeError: fetch failed' }],
    [{ message: 'connect ECONNREFUSED 127.0.0.1:443' }],
    [{ name: 'AuthRetryableFetchError', message: '' }],
  ])('detecta errores de red: %o', (err) => {
    expect(isUnreachable(err)).toBe(true);
  });

  it.each([[null], [undefined], ['fetch failed'], [{ message: 'User already registered' }], [{ message: 'plan_limit:max_users:3' }]])(
    'no confunde otros errores: %o',
    (err) => {
      expect(isUnreachable(err)).toBe(false);
    },
  );
});
