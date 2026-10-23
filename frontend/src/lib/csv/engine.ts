import { parseCsv } from './parse';
import { normalizeHeader } from './normalize';

/** Límites del archivo, comunes a todas las importaciones. */
export const MAX_FILE_BYTES = 1024 * 1024; // 1 MB
export const MAX_ROWS       = 1000;

export interface ColumnDef<K extends string = string> {
  key:          K;
  label:        string;
  required?:    boolean;
  /** Otros nombres aceptados en el encabezado (ya normalizados). */
  aliases?:     string[];
  description:  string;
  example:      string;
}

export interface RowError {
  /** Fila del archivo (1 = encabezados), o null si el error es del archivo entero. */
  line:    number | null;
  column?: string;
  message: string;
}

export type RawRow<K extends string> = Record<K, string>;

export interface ValidatedRow<T> {
  line:  number;
  value: T;
}

export interface ImportDefinition<K extends string, T, Ctx> {
  entity:   'clients' | 'quotes' | 'suppliers';
  title:    string;
  /** Texto corto para el usuario: qué representa cada fila. */
  rowHint:  string;
  columns:  ColumnDef<K>[];
  /** Reglas propias del módulo que se muestran junto a las columnas. */
  rules:    string[];
  /** Valida una fila aislada. Devuelve el valor tipado o los errores. */
  validateRow: (raw: RawRow<K>, line: number, ctx: Ctx) => { value?: T; errors: RowError[] };
  /**
   * Validaciones entre filas y contra la base (duplicados, referencias,
   * límites del plan). Devuelve errores y, opcionalmente, líneas a descartar.
   */
  validateAll?: (rows: ValidatedRow<T>[], ctx: Ctx, all: { line: number; raw: RawRow<K>; failed: boolean }[]) => RowError[];
}

export interface ValidationResult<T> {
  /** Errores que impiden procesar el archivo (columnas, tamaño, formato). */
  fileErrors: RowError[];
  rowErrors:  RowError[];
  /** Filas que pasaron todas las validaciones. */
  valid:      ValidatedRow<T>[];
  totalRows:  number;
  delimiter?: string;
}

/** Busca columnas: encabezado del archivo → key de la definición. */
function mapHeaders<K extends string>(headers: string[], columns: ColumnDef<K>[]) {
  const byName = new Map<string, K>();
  columns.forEach((c) => {
    byName.set(normalizeHeader(c.key), c.key);
    byName.set(normalizeHeader(c.label), c.key);
    c.aliases?.forEach((a) => byName.set(normalizeHeader(a), c.key));
  });

  const index = new Map<K, number>();
  const errors: RowError[] = [];
  headers.forEach((h, i) => {
    if (h.trim() === '') return;
    const key = byName.get(normalizeHeader(h));
    if (!key) {
      errors.push({ line: 1, column: h, message: `Columna desconocida "${h}". Las válidas son: ${columns.map((c) => c.key).join(', ')}.` });
    } else if (index.has(key)) {
      errors.push({ line: 1, column: h, message: `La columna "${h}" está repetida.` });
    } else {
      index.set(key, i);
    }
  });
  columns.filter((c) => c.required && !index.has(c.key)).forEach((c) => {
    errors.push({ line: 1, column: c.key, message: `Falta la columna obligatoria "${c.key}".` });
  });
  return { index, errors };
}

/** Valida un archivo CSV completo contra una definición. Nunca escribe en la base. */
export function validateCsv<K extends string, T, Ctx>(
  text: string,
  def: ImportDefinition<K, T, Ctx>,
  ctx: Ctx,
  opts: { maxRows?: number } = {},
): ValidationResult<T> {
  const maxRows = opts.maxRows ?? MAX_ROWS;
  const empty = { rowErrors: [], valid: [], totalRows: 0 };

  if (text.includes('�')) {
    return { ...empty, fileErrors: [{ line: null, message: 'El archivo no está en UTF-8. En Excel: "Guardar como" → "CSV UTF-8 (delimitado por comas)".' }] };
  }

  const parsed = parseCsv(text);
  if (parsed.headers.length === 0) {
    return { ...empty, fileErrors: [{ line: null, message: 'El archivo está vacío.' }] };
  }

  const { index, errors: headerErrors } = mapHeaders(parsed.headers, def.columns);
  const fileErrors: RowError[] = [...headerErrors];
  if (parsed.rows.length === 0) fileErrors.push({ line: null, message: 'El archivo no tiene filas de datos debajo de los encabezados.' });
  if (parsed.rows.length > maxRows) fileErrors.push({ line: null, message: `El archivo tiene ${parsed.rows.length} filas; el máximo por importación es ${maxRows}. Dividilo en varios archivos.` });
  if (fileErrors.length > 0) {
    return { fileErrors, rowErrors: [], valid: [], totalRows: parsed.rows.length, delimiter: parsed.delimiter };
  }

  const rowErrors: RowError[] = [];
  const valid: ValidatedRow<T>[] = [];
  const all: { line: number; raw: RawRow<K>; failed: boolean }[] = [];
  for (const row of parsed.rows) {
    if (row.cells.length > parsed.headers.length && row.cells.slice(parsed.headers.length).some((c) => c.trim() !== '')) {
      rowErrors.push({ line: row.line, message: `La fila tiene ${row.cells.length} valores pero hay ${parsed.headers.length} columnas. Revisá separadores o comillas.` });
      continue;
    }
    const raw = {} as RawRow<K>;
    def.columns.forEach((c) => {
      const i = index.get(c.key);
      // Quitamos el apóstrofo que agrega nuestra exportación (toCsv) para neutralizar fórmulas
      raw[c.key] = i === undefined ? '' : (row.cells[i] ?? '').trim().replace(/^'(?=[=+\-@])/, '');
    });
    const { value, errors } = def.validateRow(raw, row.line, ctx);
    const failed = errors.length > 0 || value === undefined;
    all.push({ line: row.line, raw, failed });
    if (failed) rowErrors.push(...errors);
    else valid.push({ line: row.line, value });
  }

  const crossErrors = def.validateAll?.(valid, ctx, all) ?? [];
  // Un error sin fila (p. ej. "supera el límite del plan") bloquea todo el archivo
  fileErrors.push(...crossErrors.filter((e) => e.line === null));
  const lineErrors = crossErrors.filter((e) => e.line !== null);
  const badLines = new Set(lineErrors.map((e) => e.line));
  rowErrors.push(...lineErrors);

  return {
    fileErrors,
    rowErrors: rowErrors.sort((a, b) => (a.line ?? 0) - (b.line ?? 0)),
    valid:     valid.filter((r) => !badLines.has(r.line)),
    totalRows: parsed.rows.length,
    delimiter: parsed.delimiter,
  };
}

/** Helpers para escribir reglas de columnas sin repetir mensajes. */
export const rules = {
  required(raw: string, column: string, line: number, errors: RowError[]): boolean {
    if (raw === '') { errors.push({ line, column, message: 'Es obligatorio.' }); return false; }
    return true;
  },
  maxLength(raw: string, max: number, column: string, line: number, errors: RowError[]): boolean {
    if (raw.length > max) { errors.push({ line, column, message: `Máximo ${max} caracteres (tiene ${raw.length}).` }); return false; }
    return true;
  },
  /** `allowed` es lo que se le muestra al usuario (el mapa además acepta sinónimos). */
  oneOf<V extends string>(raw: string, map: Record<string, V>, allowed: string[], column: string, line: number, errors: RowError[], fallback?: V): V | undefined {
    if (raw === '' && fallback) return fallback;
    const v = map[raw.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')];
    if (!v) errors.push({ line, column, message: `"${raw}" no es válido. Usá ${listOr(allowed)}.` });
    return v;
  },
};

/** ["a","b","c"] → "a, b o c" */
export function listOr(items: string[]): string {
  return items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} o ${items[items.length - 1]}`;
}

/** Mensaje de límite del plan para N registros nuevos. */
export function planLimitMessage(remaining: number, wanted: number, [one, many]: [string, string], period = ''): string {
  const what = (n: number) => `${n} ${n === 1 ? one : many}`;
  if (remaining === 0) return `Llegaste al límite de ${many}${period} de tu plan. Mejorá el plan para importar más.`;
  return `Tu plan permite ${what(remaining)} más${period} y el archivo tiene ${wanted}. Mejorá el plan o importá menos.`;
}
