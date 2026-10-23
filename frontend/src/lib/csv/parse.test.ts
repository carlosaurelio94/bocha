import { describe, it, expect } from 'vitest';
import { parseCsv, detectDelimiter } from './parse';
import { normalizeHeader, parseDecimal, parsePositiveInt, parseDateCell } from './normalize';

describe('parseCsv', () => {
  it('lee encabezados y filas con su número de línea', () => {
    const r = parseCsv('nombre,rif\nAna,J-1\nPedro,J-2\n');
    expect(r.headers).toEqual(['nombre', 'rif']);
    expect(r.rows).toEqual([{ line: 2, cells: ['Ana', 'J-1'] }, { line: 3, cells: ['Pedro', 'J-2'] }]);
  });

  it('detecta punto y coma (Excel en español) y tab', () => {
    expect(detectDelimiter('nombre;rif;telefono\nA;B;C')).toBe(';');
    expect(detectDelimiter('nombre\trif')).toBe('\t');
    expect(detectDelimiter('nombre,rif')).toBe(',');
    expect(parseCsv('a;b\n1;2').rows[0].cells).toEqual(['1', '2']);
  });

  it('no se confunde con separadores dentro de comillas al detectar', () => {
    expect(detectDelimiter('"a;b;c",d,e\n1,2,3')).toBe(',');
  });

  it('soporta comillas, comillas escapadas y saltos de línea dentro de una celda', () => {
    const r = parseCsv('nombre,direccion\n"Hotel ""Las Palmas""","Calle 1,\nPiso 2"\nOtro,x');
    expect(r.rows[0].cells).toEqual(['Hotel "Las Palmas"', 'Calle 1,\nPiso 2']);
    expect(r.rows[1].line).toBe(4); // la fila anterior ocupaba dos líneas
  });

  it('ignora BOM, CRLF y filas vacías', () => {
    const r = parseCsv('﻿nombre,rif\r\n\r\nAna,J-1\r\n,\r\n');
    expect(r.headers).toEqual(['nombre', 'rif']);
    expect(r.rows).toHaveLength(1);
  });

  it('archivo vacío', () => {
    expect(parseCsv('').headers).toEqual([]);
  });
});

describe('normalizadores', () => {
  it.each([
    ['Teléfono', 'telefono'], [' Precio Unitario ', 'precio_unitario'], ['N°', 'n'], ['razón-social', 'razon_social'],
  ])('header %s → %s', (h, out) => expect(normalizeHeader(h)).toBe(out));

  it.each([
    ['2.5', 2.5], ['2,5', 2.5], ['1.234,56', 1234.56], ['1,234.56', 1234.56], ['1.234.567', 1234567],
    ['$ 1500', 1500], ['0', 0], ['abc', null], ['', null], ['1,2,3', 123],
  ])('decimal "%s" → %s', (raw, out) => expect(parseDecimal(raw)).toBe(out));

  it.each([['3', 3], ['0', null], ['-1', null], ['1.5', null], ['3a', null]])(
    'entero "%s" → %s', (raw, out) => expect(parsePositiveInt(raw)).toBe(out));

  it.each([
    ['15/10/2026', '2026-10-15'], ['2026-10-15', '2026-10-15'], ['5-3-2026', '2026-03-05'], ['05.03.2026', '2026-03-05'],
    ['31/02/2026', null], ['2026/10/15', null], ['15/10/26', null], ['32/01/2026', null], ['01/01/1990', null],
  ])('fecha "%s" → %s', (raw, out) => expect(parseDateCell(raw)).toBe(out));
});
