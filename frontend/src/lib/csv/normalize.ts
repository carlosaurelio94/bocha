/** Normalizadores de celdas para la importación CSV. */

/** "Teléfono " → "telefono", "Precio unitario" → "precio_unitario". */
export function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

/** Para comparar textos libres: minúsculas, sin acentos y sin espacios repetidos. */
export function normalizeText(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
}

/**
 * Número decimal escrito a la latina o a la inglesa:
 * "2.5", "2,5", "1.234,56", "1,234.56", "$ 1.500" → número; inválido → null.
 * Regla: si aparecen punto y coma, el último es el separador decimal. Si solo
 * hay uno y se repite ("1.234.567"), es separador de miles.
 */
export function parseDecimal(raw: string): number | null {
  let s = raw.trim().replace(/^[$€]|^bs\.?/i, '').replace(/\s/g, '');
  if (s === '') return null;
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  if (lastDot !== -1 && lastComma !== -1) {
    const dec = lastDot > lastComma ? '.' : ',';
    const thousands = dec === '.' ? ',' : '.';
    s = s.split(thousands).join('').replace(dec, '.');
  } else if (lastComma !== -1) {
    s = (s.match(/,/g)!.length > 1) ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if (lastDot !== -1 && s.match(/\./g)!.length > 1) {
    s = s.replace(/\./g, '');
  }
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

/** Entero positivo estricto ("3", "3.0" no). */
export function parsePositiveInt(raw: string): number | null {
  const s = raw.trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return n > 0 ? n : null;
}

/**
 * Fecha en AAAA-MM-DD o DD/MM/AAAA (también con guiones o puntos) → "AAAA-MM-DD".
 * Valida que la fecha exista (31/02 es inválida). Inválida → null.
 */
export function parseDateCell(raw: string): string | null {
  const s = raw.trim();
  let y: number, m: number, d: number;
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (match) { y = +match[1]; m = +match[2]; d = +match[3]; }
  else {
    match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
    if (!match) return null;
    d = +match[1]; m = +match[2]; y = +match[3];
  }
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  if (y < 2000 || y > 2100) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
