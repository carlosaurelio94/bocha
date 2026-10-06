import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSupabaseMock } from '@/test/supabaseMock';
import type { CreateQuoteDTO } from '@/types';

const sb = vi.hoisted(() => ({ mock: null as unknown as ReturnType<typeof createSupabaseMock> }));
vi.mock('./supabase', async () => {
  const { createSupabaseMock } = await import('@/test/supabaseMock');
  sb.mock = createSupabaseMock();
  return { supabase: sb.mock.client };
});

import { getQuotes, createQuote, updateQuoteStatus, deleteQuote, getNextQuoteNumber } from './quotes';

beforeEach(() => {
  sb.mock.reset();
  localStorage.setItem('device_id', 'device_test');
});

const dto: CreateQuoteDTO = {
  client_id: 'cl1', information_id: 'info1', quote_number: 7, quote_date: '2026-10-06',
  total_amount: 30, item_count: 2, currency: '$', status: 'draft',
  items: [
    { product: 'Ficus', quantity: 1, unit_price: 10, total_price: 10 },
    { product: 'Palma', quantity: 2, unit_price: 10, total_price: 20 },
  ],
};

describe('getQuotes', () => {
  it('pagina, ordena por fecha y aplica filtros', async () => {
    sb.mock.respond('quotes', { data: [], count: 3 });
    const res = await getQuotes({ page: 2, pageSize: 10, status: 'sent', clientId: 'cl1', search: 'ana' });

    expect(res.total).toBe(3);
    const ops = sb.mock.lastOps('quotes');
    expect(ops).toContainEqual(['range', [10, 19]]);
    expect(ops).toContainEqual(['order', ['quote_date', { ascending: false }]]);
    expect(ops).toContainEqual(['eq', ['status', 'sent']]);
    expect(ops).toContainEqual(['eq', ['client_id', 'cl1']]);
    expect(ops).toContainEqual(['ilike', ['clients.name', '%ana%']]);
  });

  it('propaga errores', async () => {
    sb.mock.respond('quotes', { error: new Error('down') });
    await expect(getQuotes({ page: 1, pageSize: 10 })).rejects.toThrow('down');
  });
});

describe('createQuote', () => {
  it('inserta la cabecera sin los ítems y luego los ítems con el id del presupuesto', async () => {
    sb.mock.respond('quotes', { data: { id: 'q1' } });

    const quote = await createQuote(dto);

    expect(quote).toEqual({ id: 'q1' });
    const [header] = sb.mock.lastOps('quotes')[0][1] as [Record<string, unknown>];
    expect(header).not.toHaveProperty('items');
    expect(header).toMatchObject({ client_id: 'cl1', quote_number: 7, created_by: 'device_test' });

    const [items] = sb.mock.lastOps('quote_items')[0][1] as [Record<string, unknown>[]];
    expect(items).toHaveLength(2);
    items.forEach((i) => expect(i).toMatchObject({ quote_id: 'q1', client_id: 'cl1', information_id: 'info1', created_by: 'device_test' }));
  });

  it('no consulta quote_items si falla la cabecera', async () => {
    sb.mock.respond('quotes', { error: new Error('dup') });
    await expect(createQuote(dto)).rejects.toThrow('dup');
    expect(sb.mock.queries.some((q) => q.table === 'quote_items')).toBe(false);
  });

  it('propaga el error al insertar ítems', async () => {
    sb.mock.respond('quotes', { data: { id: 'q1' } });
    sb.mock.respond('quote_items', { error: new Error('items') });
    await expect(createQuote(dto)).rejects.toThrow('items');
  });

  it('no inserta ítems si la lista viene vacía', async () => {
    sb.mock.respond('quotes', { data: { id: 'q1' } });
    await createQuote({ ...dto, items: [] });
    expect(sb.mock.queries.some((q) => q.table === 'quote_items')).toBe(false);
  });
});

describe('updateQuoteStatus / deleteQuote', () => {
  it('actualiza el estado del presupuesto indicado', async () => {
    await updateQuoteStatus('q1', 'approved');
    const ops = sb.mock.lastOps('quotes');
    expect(ops[0]).toEqual(['update', [{ status: 'approved', updated_by: 'device_test' }]]);
    expect(ops).toContainEqual(['eq', ['id', 'q1']]);
  });

  it('deleteQuote marca borrados los ítems y la cabecera', async () => {
    await deleteQuote('q1');
    expect(sb.mock.lastOps('quote_items')).toContainEqual(['eq', ['quote_id', 'q1']]);
    expect(sb.mock.lastOps('quotes')[0]).toEqual(['update', [{ deleted: true, updated_by: 'device_test' }]]);
  });
});

describe('getNextQuoteNumber', () => {
  it('devuelve el mayor número + 1', async () => {
    sb.mock.respond('quotes', { data: { quote_number: 41 } });
    expect(await getNextQuoteNumber()).toBe(42);
  });

  it('empieza en 1 si no hay presupuestos', async () => {
    sb.mock.respond('quotes', { data: null, error: { code: 'PGRST116' } });
    expect(await getNextQuoteNumber()).toBe(1);
  });
});
