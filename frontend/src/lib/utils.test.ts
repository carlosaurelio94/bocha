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

// ─── Fechas: los tests corren en America/Caracas (UTC-4), ver vitest.config ───
import { parseDate, toLocalISODate, monthRange, toCsv, sanitizeSearch } from './utils';

describe('zona horaria de los tests', () => {
  it('corre en UTC-4 para detectar corrimientos de fecha', () => {
    expect(new Date(2026, 9, 6).getTimezoneOffset()).toBe(240);
  });
});

describe('parseDate / formatDate con columnas DATE', () => {
  it('una fecha YYYY-MM-DD no se corre al día anterior', () => {
    const d = parseDate('2026-10-06');
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 9, 6]);
    expect(formatDate('2026-10-06')).toMatch(/^06/);
  });

  it('el primer día del mes sigue siendo del mismo mes', () => {
    expect(formatDate('2026-10-01')).toMatch(/oct/i);
  });

  it('timestamps completos se siguen interpretando como instantes', () => {
    expect(parseDate('2026-10-06T12:00:00Z').toISOString()).toBe('2026-10-06T12:00:00.000Z');
  });

  it('formato largo para el PDF', () => {
    expect(formatDate('2026-10-06', 'long')).toMatch(/octubre/i);
  });
});

describe('toLocalISODate', () => {
  it('a las 21h locales sigue siendo el mismo día (toISOString daba el siguiente)', () => {
    const nineAtNight = new Date(2026, 9, 6, 21, 30);
    expect(nineAtNight.toISOString().slice(0, 10)).toBe('2026-10-07'); // el bug original
    expect(toLocalISODate(nineAtNight)).toBe('2026-10-06');
  });
});

describe('monthRange', () => {
  it('devuelve primer y último día del mes', () => {
    expect(monthRange(new Date(2026, 1, 15))).toEqual({ start: '2026-02-01', end: '2026-02-28' });
    expect(monthRange(new Date(2028, 1, 15)).end).toBe('2028-02-29');
    expect(monthRange(new Date(2026, 11, 31, 23, 0))).toEqual({ start: '2026-12-01', end: '2026-12-31' });
  });
});

describe('toCsv', () => {
  it('escapa comillas y separa con comas', () => {
    expect(toCsv([['Hotel "Las Palmas"', 10]])).toBe('﻿"Hotel ""Las Palmas""","10"');
  });

  it('neutraliza celdas que Excel ejecutaría como fórmula', () => {
    const csv = toCsv([['=HYPERLINK("http://x")', '+1', '@cmd', 'normal', -5]]);
    expect(csv).toContain(`"'=HYPERLINK(""http://x"")"`);
    expect(csv).toContain(`"'+1"`);
    expect(csv).toContain(`"'@cmd"`);
    expect(csv).toContain('"-5"'); // los números negativos no se tocan
  });

  it('incluye BOM para que Excel lea bien los acentos y usa CRLF', () => {
    const csv = toCsv([['Ñandú'], ['José']]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('\r\n');
  });

  it('celdas vacías', () => {
    expect(toCsv([[null, undefined]])).toBe('﻿"",""');
  });
});

describe('sanitizeSearch', () => {
  it.each([
    ['Jardines del Este, C.A.', 'Jardines del Este C.A.'],
    ['ana (vip)', 'ana vip'],
    ['100%', '100'],
    ['  ana   torres ', 'ana torres'],
    ['a*b\\c', 'a b c'],
  ])('"%s" → "%s"', (input, out) => {
    expect(sanitizeSearch(input)).toBe(out);
  });
});
