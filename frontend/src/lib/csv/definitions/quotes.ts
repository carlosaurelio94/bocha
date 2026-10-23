import { planLimitMessage, rules, type ImportDefinition, type RowError } from '../engine';
import { normalizeText, parseDateCell, parseDecimal, parsePositiveInt } from '../normalize';
import { normalizeRif } from './clients';
import type { QuoteStatus } from '@/types';

export type QuoteColumn = 'numero' | 'cliente' | 'fecha' | 'moneda' | 'estado' | 'producto' | 'cantidad' | 'precio_unitario';

/** Una fila = un ítem. Las filas con el mismo número forman un presupuesto. */
export interface QuoteItemImportRow {
  quote_number: number;
  client_id:    string;
  client_name:  string;
  quote_date:   string;
  currency:     '$' | 'Bs' | '€';
  status:       QuoteStatus;
  product:      string;
  quantity:     number;
  unit_price:   number;
}

export interface QuoteImportContext {
  clients:           { id: string; name: string; rif: string | null }[];
  /** Números de presupuesto ya usados (incluye borrados: el índice único los cuenta). */
  existingNumbers:   Set<number>;
  /** Cuántos presupuestos más permite el plan este mes (null = sin límite). */
  remainingThisMonth: number | null;
}

const CURRENCY: Record<string, QuoteItemImportRow['currency']> = {
  '$': '$', usd: '$', dolar: '$', dolares: '$', 'us$': '$',
  bs: 'Bs', 'bs.': 'Bs', ves: 'Bs', bolivares: 'Bs', bolivar: 'Bs',
  '€': '€', eur: '€', euro: '€', euros: '€',
};

const STATUS: Record<string, QuoteStatus> = {
  borrador: 'draft', draft: 'draft',
  enviado: 'sent', sent: 'sent',
  aprobado: 'approved', approved: 'approved',
  rechazado: 'rejected', rejected: 'rejected',
};

/** Busca el cliente por RIF (exacto) o por nombre (sin mayúsculas ni acentos). */
function findClient(ctx: QuoteImportContext, value: string):
  { client?: QuoteImportContext['clients'][number]; error?: string } {
  const rif = normalizeRif(value);
  const byRif = ctx.clients.filter((c) => c.rif && normalizeRif(c.rif) === rif);
  if (byRif.length === 1) return { client: byRif[0] };
  const name = normalizeText(value);
  const byName = ctx.clients.filter((c) => normalizeText(c.name) === name);
  if (byName.length === 1) return { client: byName[0] };
  if (byName.length > 1) return { error: `Hay ${byName.length} clientes llamados "${value}". Usá el RIF.` };
  return { error: `No existe el cliente "${value}". Cargalo antes (o importá primero los clientes).` };
}

export const quotesImport: ImportDefinition<QuoteColumn, QuoteItemImportRow, QuoteImportContext> = {
  entity:  'quotes',
  title:   'Importar presupuestos',
  rowHint: 'Una fila por ítem. Las filas con el mismo número forman un presupuesto.',
  columns: [
    { key: 'numero',          label: 'Número',          required: true, aliases: ['n', 'nro', 'numero_presupuesto', 'quote_number'], description: 'Número entero. Las filas con el mismo número son ítems del mismo presupuesto.', example: '101' },
    { key: 'cliente',         label: 'Cliente',         required: true, aliases: ['client', 'rif', 'cliente_rif'], description: 'RIF o nombre exacto de un cliente ya cargado.', example: 'J-12345678-9' },
    { key: 'fecha',           label: 'Fecha',           required: true, aliases: ['date', 'quote_date'], description: 'DD/MM/AAAA o AAAA-MM-DD.', example: '15/10/2026' },
    { key: 'moneda',          label: 'Moneda',          aliases: ['currency'], description: '$, Bs o €. Si está vacía: $.', example: '$' },
    { key: 'estado',          label: 'Estado',          aliases: ['status'], description: 'borrador, enviado, aprobado o rechazado. Si está vacío: borrador.', example: 'enviado' },
    { key: 'producto',        label: 'Producto',        required: true, aliases: ['product', 'descripcion', 'item', 'servicio'], description: 'Producto o servicio (hasta 200 caracteres).', example: 'Ficus 40cm' },
    { key: 'cantidad',        label: 'Cantidad',        required: true, aliases: ['quantity', 'cant'], description: 'Número entero mayor a 0.', example: '3' },
    { key: 'precio_unitario', label: 'Precio unitario', required: true, aliases: ['precio', 'unit_price', 'price'], description: 'Mayor o igual a 0. Acepta 1234,56 o 1234.56.', example: '25,50' },
  ],
  rules: [
    'El número no puede existir ya en tus presupuestos (ni repetirse con datos distintos en el archivo).',
    'Todas las filas de un mismo número deben tener el mismo cliente, fecha, moneda y estado.',
    'Si un ítem tiene un error, se descarta el presupuesto completo (nunca se cargan presupuestos a medias).',
    'Máximo 100 ítems por presupuesto y no se puede superar el límite mensual de tu plan.',
  ],

  validateRow(raw, line, ctx) {
    const errors: RowError[] = [];
    const quoteNumber = rules.required(raw.numero, 'numero', line, errors) ? parsePositiveInt(raw.numero) : null;
    if (raw.numero && quoteNumber === null) errors.push({ line, column: 'numero', message: 'Tiene que ser un número entero mayor a 0.' });

    let client: QuoteImportContext['clients'][number] | undefined;
    if (rules.required(raw.cliente, 'cliente', line, errors)) {
      const found = findClient(ctx, raw.cliente);
      if (found.error) errors.push({ line, column: 'cliente', message: found.error });
      client = found.client;
    }

    const date = rules.required(raw.fecha, 'fecha', line, errors) ? parseDateCell(raw.fecha) : null;
    if (raw.fecha && date === null) errors.push({ line, column: 'fecha', message: `Fecha inválida "${raw.fecha}". Usá DD/MM/AAAA o AAAA-MM-DD.` });

    const currency = raw.moneda === '' ? '$' : CURRENCY[normalizeText(raw.moneda)];
    if (!currency) errors.push({ line, column: 'moneda', message: `Moneda "${raw.moneda}" no válida. Usá $, Bs o €.` });
    const status = rules.oneOf(raw.estado, STATUS, ['borrador', 'enviado', 'aprobado', 'rechazado'], 'estado', line, errors, 'draft');

    if (rules.required(raw.producto, 'producto', line, errors)) rules.maxLength(raw.producto, 200, 'producto', line, errors);

    const quantity = rules.required(raw.cantidad, 'cantidad', line, errors) ? parsePositiveInt(raw.cantidad) : null;
    if (raw.cantidad && quantity === null) errors.push({ line, column: 'cantidad', message: 'Tiene que ser un número entero mayor a 0 (sin decimales).' });

    const price = rules.required(raw.precio_unitario, 'precio_unitario', line, errors) ? parseDecimal(raw.precio_unitario) : null;
    if (raw.precio_unitario && (price === null || price < 0)) errors.push({ line, column: 'precio_unitario', message: `Precio inválido "${raw.precio_unitario}". Tiene que ser un número mayor o igual a 0.` });

    if (errors.length > 0 || !client || quoteNumber === null || !date || !currency || !status || quantity === null || price === null) {
      return { errors };
    }
    return {
      errors,
      value: {
        quote_number: quoteNumber, client_id: client.id, client_name: client.name,
        quote_date: date, currency, status, product: raw.producto, quantity,
        unit_price: Math.round(price * 100) / 100,
      },
    };
  },

  validateAll(rows, ctx, all) {
    const errors: RowError[] = [];

    // Números con algún ítem inválido: se descarta el presupuesto entero
    const failedNumbers = new Set(all.filter((r) => r.failed).map((r) => parsePositiveInt(r.raw.numero)).filter((n): n is number => n !== null));

    const groups = new Map<number, typeof rows>();
    rows.forEach((r) => {
      const g = groups.get(r.value.quote_number) ?? [];
      g.push(r);
      groups.set(r.value.quote_number, g);
    });

    let okQuotes = 0;
    for (const [number, items] of groups) {
      const groupErrors: RowError[] = [];
      if (ctx.existingNumbers.has(number)) {
        items.forEach(({ line }) => groupErrors.push({ line, column: 'numero', message: `El presupuesto #${number} ya existe.` }));
      } else if (failedNumbers.has(number)) {
        items.forEach(({ line }) => groupErrors.push({ line, column: 'numero', message: `Se descarta: otro ítem del presupuesto #${number} tiene errores.` }));
      } else {
        const [first] = items;
        for (const { line, value } of items.slice(1)) {
          const diff = (['client_id', 'quote_date', 'currency', 'status'] as const)
            .filter((k) => value[k] !== first.value[k]);
          if (diff.length > 0) {
            const names = { client_id: 'cliente', quote_date: 'fecha', currency: 'moneda', status: 'estado' };
            groupErrors.push({ line, column: names[diff[0]], message: `No coincide con la fila ${first.line} del presupuesto #${number} (${diff.map((d) => names[d]).join(', ')}).` });
          }
        }
        if (items.length > 100) groupErrors.push({ line: items[100].line, column: 'numero', message: `El presupuesto #${number} tiene ${items.length} ítems; el máximo es 100.` });
        // Si una fila del grupo no coincide, se descarta el grupo completo
        if (groupErrors.length > 0) {
          const flagged = new Set(groupErrors.map((e) => e.line));
          items.filter(({ line }) => !flagged.has(line)).forEach(({ line }) =>
            groupErrors.push({ line, column: 'numero', message: `Se descarta: otro ítem del presupuesto #${number} tiene errores.` }));
        } else okQuotes++;
      }
      errors.push(...groupErrors);
    }

    if (ctx.remainingThisMonth !== null && okQuotes > ctx.remainingThisMonth) {
      errors.push({ line: null, message: planLimitMessage(ctx.remainingThisMonth, okQuotes, ['presupuesto', 'presupuestos'], ' este mes') });
    }
    return errors;
  },
};

/** Agrupa los ítems validados en presupuestos listos para crear. */
export function groupQuotes(rows: { value: QuoteItemImportRow }[]) {
  const map = new Map<number, QuoteItemImportRow[]>();
  rows.forEach(({ value }) => map.set(value.quote_number, [...(map.get(value.quote_number) ?? []), value]));
  return [...map.entries()].sort(([a], [b]) => a - b).map(([quote_number, items]) => {
    const total = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
    const [h] = items;
    return {
      client_name: h.client_name,
      dto: {
        client_id:    h.client_id,
        quote_number,
        quote_date:   h.quote_date,
        currency:     h.currency,
        status:       h.status,
        total_amount: Math.round(total * 100) / 100,
        item_count:   items.length,
        items: items.map((i) => ({
          product: i.product, quantity: i.quantity, unit_price: i.unit_price,
          total_price: Math.round(i.quantity * i.unit_price * 100) / 100,
        })),
      },
    };
  });
}
