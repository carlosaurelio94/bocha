/**
 * Acceso a datos de la importación CSV: arma el contexto de validación
 * (lo que ya existe en la base) y ejecuta la carga.
 */
import { supabase } from '@/lib/supabase';
import { createQuote } from '@/lib/quotes';
import { getDeviceId, monthRange, toCsv } from '@/lib/utils';
import { friendlyError } from '@/lib/errors';
import { normalizeText } from './normalize';
import { normalizeRif, clientsImport, type ClientImportContext, type ClientImportRow } from './definitions/clients';
import { suppliersImport, type SupplierImportContext, type SupplierImportRow } from './definitions/suppliers';
import { quotesImport, groupQuotes, type QuoteImportContext, type QuoteItemImportRow } from './definitions/quotes';
import type { ColumnDef, ValidatedRow } from './engine';

const PAGE = 1000;
const CHUNK = 100;

/** Trae todas las filas paginando (PostgREST corta en 1000 por consulta). */
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

/** Cuántos registros más permite el plan (null = sin límite o no se pudo saber). */
async function remainingFor(companyId: string | undefined, field: string, used: number): Promise<number | null> {
  if (!companyId) return null;
  const { data, error } = await supabase.rpc('company_limit', { p_company: companyId, p_field: field });
  // Solo un número es un límite real; null (enterprise) o una respuesta rara no limitan
  const limit = typeof data === 'number' ? data : typeof data === 'string' && /^\d+$/.test(data) ? Number(data) : null;
  if (error || limit === null) return null;
  return Math.max(0, limit - used);
}

// ─── Contextos ────────────────────────────────────────────────────────────────

export async function loadClientsContext(companyId?: string): Promise<ClientImportContext> {
  const rows = await fetchAll<{ name: string; rif: string | null }>((from, to) =>
    supabase.from('clients').select('name, rif').eq('deleted', false).range(from, to));
  return {
    existingRifs:  new Set(rows.filter((r) => r.rif).map((r) => normalizeRif(r.rif!))),
    existingNames: new Set(rows.map((r) => normalizeText(r.name))),
    remaining:     await remainingFor(companyId, 'max_clients', rows.length),
  };
}

export async function loadSuppliersContext(): Promise<SupplierImportContext> {
  const rows = await fetchAll<{ legal_name: string; tax_id: string | null }>((from, to) =>
    supabase.from('suppliers').select('legal_name, tax_id').range(from, to));
  return {
    existingTaxIds: new Set(rows.filter((r) => r.tax_id).map((r) => normalizeRif(r.tax_id!))),
    existingNames:  new Set(rows.map((r) => normalizeText(r.legal_name))),
  };
}

export async function loadQuotesContext(companyId?: string): Promise<QuoteImportContext> {
  const [clients, numbers] = await Promise.all([
    fetchAll<{ id: string; name: string; rif: string | null }>((from, to) =>
      supabase.from('clients').select('id, name, rif').eq('deleted', false).range(from, to)),
    // Incluye borrados: el índice único (company_id, quote_number) también los cuenta
    fetchAll<{ quote_number: number }>((from, to) =>
      supabase.from('quotes').select('quote_number').range(from, to)),
  ]);
  const { count } = await supabase.from('quotes').select('id', { count: 'exact', head: true })
    .gte('created_at', `${monthRange().start}T00:00:00`);
  return {
    clients,
    existingNumbers:    new Set(numbers.map((n) => n.quote_number)),
    remainingThisMonth: await remainingFor(companyId, 'max_quotes_per_month', count ?? 0),
  };
}

// ─── Ejecución ────────────────────────────────────────────────────────────────

export interface ImportOutcome {
  imported: number;
  failed:   { label: string; message: string }[];
}

type Progress = (done: number, total: number) => void;

async function insertInChunks<T extends object>(table: string, rows: T[], label: (r: T) => string, onProgress?: Progress): Promise<ImportOutcome> {
  const outcome: ImportOutcome = { imported: 0, failed: [] };
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabase.from(table).insert(chunk as never);
    if (error) {
      const message = friendlyError(error, 'No se pudo guardar este bloque.');
      chunk.forEach((r) => outcome.failed.push({ label: label(r), message }));
    } else {
      outcome.imported += chunk.length;
    }
    onProgress?.(Math.min(i + CHUNK, rows.length), rows.length);
  }
  return outcome;
}

export function importClients(rows: ValidatedRow<ClientImportRow>[], onProgress?: Progress) {
  const createdBy = getDeviceId();
  return insertInChunks('clients', rows.map((r) => ({ ...r.value, created_by: createdBy })), (r) => r.name, onProgress);
}

export function importSuppliers(rows: ValidatedRow<SupplierImportRow>[], onProgress?: Progress) {
  return insertInChunks('suppliers', rows.map((r) => r.value), (r) => r.legal_name, onProgress);
}

/** Crea los presupuestos de a uno (cabecera + ítems, con la compensación de createQuote). */
export async function importQuotes(rows: ValidatedRow<QuoteItemImportRow>[], onProgress?: Progress): Promise<ImportOutcome> {
  const quotes = groupQuotes(rows);
  const outcome: ImportOutcome = { imported: 0, failed: [] };
  for (let i = 0; i < quotes.length; i++) {
    const { dto, client_name } = quotes[i];
    const label = `#${String(dto.quote_number).padStart(4, '0')} · ${client_name}`;
    try {
      const created = await createQuote(dto);
      outcome.imported++;
      if (created.quote_number && created.quote_number !== dto.quote_number) {
        outcome.failed.push({ label, message: `Se guardó como #${created.quote_number}: el número ya estaba en uso.` });
      }
    } catch (error) {
      outcome.failed.push({ label, message: friendlyError(error, 'No se pudo guardar.') });
    }
    onProgress?.(i + 1, quotes.length);
  }
  return outcome;
}

// ─── Plantillas ───────────────────────────────────────────────────────────────

export const IMPORTS = {
  clients:   clientsImport,
  quotes:    quotesImport,
  suppliers: suppliersImport,
} as const;

const TEMPLATE_EXTRA_ROWS: Record<keyof typeof IMPORTS, string[][]> = {
  clients:   [['María López', '', '0414-5550202', '', 'prospecto']],
  suppliers: [['Riego del Sur SRL', '', '', 'Riego', '']],
  quotes:    [['101', 'J-12345678-9', '15/10/2026', '$', 'enviado', 'Tierra abonada 10kg', '2', '8'],
              ['102', 'María López', '16/10/2026', 'Bs', 'borrador', 'Mantenimiento mensual', '1', '1500']],
};

/** CSV de ejemplo: encabezados + filas de muestra que pasan la validación. */
export function buildTemplate(entity: keyof typeof IMPORTS): string {
  const columns = IMPORTS[entity].columns as ColumnDef[];
  return toCsv([
    columns.map((c) => c.key),
    columns.map((c) => c.example),
    ...TEMPLATE_EXTRA_ROWS[entity],
  ]);
}
