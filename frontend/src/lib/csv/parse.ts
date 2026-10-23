/**
 * Parser CSV (RFC 4180) sin dependencias.
 * - Detecta el separador: coma, punto y coma (Excel en español) o tab.
 * - Soporta comillas, comillas escapadas ("") y saltos de línea dentro de comillas.
 * - Ignora el BOM y las filas totalmente vacías.
 */
export type Delimiter = ',' | ';' | '\t';

export interface ParsedCsv {
  delimiter: Delimiter;
  headers:   string[];
  /** Filas de datos (sin la de encabezados). `line` es el número de fila en el archivo (1 = encabezados). */
  rows:      { line: number; cells: string[] }[];
}

export function detectDelimiter(text: string): Delimiter {
  const firstLine = firstLogicalLine(text);
  const counts: Record<Delimiter, number> = { ',': 0, ';': 0, '\t': 0 };
  let inQuotes = false;
  for (const ch of firstLine) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch in counts) counts[ch as Delimiter]++;
  }
  // Empate o sin separadores: coma
  if (counts[';'] > counts[','] && counts[';'] >= counts['\t']) return ';';
  if (counts['\t'] > counts[','] && counts['\t'] > counts[';']) return '\t';
  return ',';
}

function firstLogicalLine(text: string): string {
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && (ch === '\n' || ch === '\r')) return text.slice(0, i);
  }
  return text;
}

export function parseCsv(input: string, delimiter?: Delimiter): ParsedCsv {
  const text = input.replace(/^﻿/, '');
  const sep  = delimiter ?? detectDelimiter(text);

  const records: { line: number; cells: string[] }[] = [];
  let cells: string[] = [];
  let cell = '';
  let inQuotes = false;
  let line = 1;          // línea física actual
  let recordStart = 1;   // línea donde empezó el registro

  const endCell = () => { cells.push(cell); cell = ''; };
  const endRecord = () => {
    endCell();
    if (cells.some((c) => c.trim() !== '')) records.push({ line: recordStart, cells });
    cells = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else {
        if (ch === '\n') line++;
        cell += ch;
      }
      continue;
    }
    if (ch === '"' && cell.trim() === '') { cell = ''; inQuotes = true; }
    else if (ch === sep) endCell();
    else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      endRecord();
      line++;
      recordStart = line;
    } else cell += ch;
  }
  if (cell !== '' || cells.length > 0) endRecord();

  const [header, ...rest] = records;
  return {
    delimiter: sep,
    headers:   header ? header.cells.map((h) => h.trim()) : [],
    rows:      rest,
  };
}
