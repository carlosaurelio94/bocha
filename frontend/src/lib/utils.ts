import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = '$'): string {
  return `${currency} ${amount.toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Convierte un string de fecha a Date respetando las fechas "puras".
 *
 * `new Date('2026-10-06')` se interpreta como medianoche UTC, que en
 * Venezuela/Argentina (UTC-4/-3) es el día ANTERIOR. Las columnas DATE de
 * Postgres llegan así, por eso las armamos como fecha local.
 */
export function parseDate(dateStr: string): Date {
  const m = DATE_ONLY.exec(dateStr);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(dateStr);
}

export function formatDate(dateStr: string, month: 'short' | 'long' = 'short'): string {
  return parseDate(dateStr).toLocaleDateString('es-VE', {
    day: '2-digit',
    month,
    year: 'numeric',
  });
}

/**
 * Fecha local en formato YYYY-MM-DD (para inputs type="date" y columnas DATE).
 * Ojo: `toISOString().slice(0, 10)` da la fecha UTC — después de las 20h en
 * Venezuela ya devuelve el día siguiente.
 */
export function toLocalISODate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Primer y último día (inclusive) del mes de `date`, como YYYY-MM-DD locales. */
export function monthRange(date: Date = new Date()): { start: string; end: string } {
  return {
    start: toLocalISODate(new Date(date.getFullYear(), date.getMonth(), 1)),
    end:   toLocalISODate(new Date(date.getFullYear(), date.getMonth() + 1, 0)),
  };
}

/**
 * Arma un CSV seguro: escapa comillas, y neutraliza celdas que Excel
 * interpretaría como fórmula (=, +, -, @) para evitar "CSV injection".
 * Incluye BOM para que Excel abra bien los acentos.
 */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined) => {
    if (v == null) return '""';
    let s = String(v);
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  return '\uFEFF' + rows.map((r) => r.map(cell).join(',')).join('\r\n');
}

/**
 * Limpia un texto de búsqueda para los filtros `.or()` / `.ilike()` de
 * PostgREST: comas y paréntesis rompen la sintaxis del filtro, y % / _
 * son comodines.
 */
export function sanitizeSearch(term: string): string {
  return term.replace(/[,()%_\\*]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'server';
  let id = localStorage.getItem('device_id');
  if (!id) {
    id = `device_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem('device_id', id);
  }
  return id;
}
