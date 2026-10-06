import { describe, it, expect } from 'vitest';
import { cn, formatCurrency, formatDate, getDeviceId } from './utils';

describe('cn', () => {
  it('combina clases y descarta valores falsy', () => {
    expect(cn('a', false && 'b', undefined, 'c')).toBe('a c');
  });

  it('resuelve conflictos de Tailwind quedándose con la última', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
  });
});

describe('formatCurrency', () => {
  it('usa $ por defecto y siempre dos decimales', () => {
    expect(formatCurrency(1234.5)).toMatch(/^\$ 1\.234,50$/);
  });

  it('respeta el símbolo de moneda recibido', () => {
    expect(formatCurrency(10, 'Bs')).toBe('Bs 10,00');
    expect(formatCurrency(0, '€')).toBe('€ 0,00');
  });

  it('redondea a dos decimales', () => {
    expect(formatCurrency(1 / 3)).toBe('$ 0,33');
  });
});

describe('formatDate', () => {
  it('formatea con día, mes abreviado y año', () => {
    const out = formatDate('2026-10-06T12:00:00Z');
    expect(out).toMatch(/06/);
    expect(out).toMatch(/oct/i);
    expect(out).toMatch(/2026/);
  });
});

describe('getDeviceId', () => {
  it('genera un id y lo persiste en localStorage', () => {
    const first = getDeviceId();
    expect(first).toMatch(/^device_\d+_[a-z0-9]+$/);
    expect(localStorage.getItem('device_id')).toBe(first);
  });

  it('devuelve el mismo id en llamadas sucesivas', () => {
    expect(getDeviceId()).toBe(getDeviceId());
  });

  it('reutiliza un id ya guardado', () => {
    localStorage.setItem('device_id', 'device_existente');
    expect(getDeviceId()).toBe('device_existente');
  });
});
