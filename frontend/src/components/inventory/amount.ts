import { parseDecimal } from '@/lib/csv/normalize';

/**
 * Número de un input escrito a mano: acepta "1,5" y "1.5". Devuelve null si
 * no es un número válido con hasta 2 decimales (así lo guarda la base).
 */
export function parseAmount(raw: string): number | null {
  const n = parseDecimal(raw);
  if (n === null || !Number.isFinite(n) || Math.abs(n) >= 1e10) return null;
  return Math.round(n * 100) / 100 === n ? n : null;
}
