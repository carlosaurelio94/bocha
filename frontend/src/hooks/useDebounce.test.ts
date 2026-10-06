import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce } from './useDebounce';

afterEach(() => vi.useRealTimers());

describe('useDebounce', () => {
  it('devuelve el valor inicial inmediatamente', () => {
    const { result } = renderHook(() => useDebounce('hola', 300));
    expect(result.current).toBe('hola');
  });

  it('solo emite el último valor cuando deja de cambiar', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 300), { initialProps: { v: 'a' } });

    rerender({ v: 'ab' });
    act(() => { vi.advanceTimersByTime(200); });
    rerender({ v: 'abc' });
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current).toBe('a');

    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current).toBe('abc');
  });
});
