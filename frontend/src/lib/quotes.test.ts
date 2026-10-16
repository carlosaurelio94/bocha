import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSupabaseMock } from '@/test/supabaseMock';
import type { CreateQuoteDTO } from '@/types';

const sb = vi.hoisted(() => ({ mock: null as unknown as ReturnType<typeof createSupabaseMock> }));
vi.mock('./supabase', async () => {
  const { createSupabaseMock } = await import('@/test/supabaseMock');
  sb.mock = createSupabaseMock();
  return { supabase: sb.mock.client };
});

import { getQuotes, getQuoteById, createQuote, updateQuote, updateQuoteStatus, deleteQuote, getNextQuoteNumber } from './quotes';

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

  it('al buscar por cliente usa !inner para que el filtro descarte presupuestos', async () => {
    await getQuotes({ page: 1, pageSize: 10, search: 'ana' });
    const select = String(sb.mock.lastOps('quotes').find(([m]) => m === 'select')?.[1][0]);
    expect(select).toContain('client:clients!inner(');
  });

  it('sin búsqueda no fuerza el inner join (presupuestos sin cliente siguen apareciendo)', async () => {
    await getQuotes({ page: 1, pageSize: 10 });
    const select = String(sb.mock.lastOps('quotes').find(([m]) => m === 'select')?.[1][0]);
    expect(select).not.toContain('!inner');
  });

  it('limpia comodines y caracteres especiales de la búsqueda', async () => {
    await getQuotes({ page: 1, pageSize: 10, search: '100%, (ana)' });
    expect(sb.mock.lastOps('quotes')).toContainEqual(['ilike', ['clients.name', '%100 ana%']]);
  });

  it('una búsqueda solo con caracteres especiales no filtra', async () => {
    await getQuotes({ page: 1, pageSize: 10, search: '%,' });
    expect(sb.mock.lastOps('quotes').some(([m]) => m === 'ilike')).toBe(false);
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

  it('si fallan los ítems, da de baja la cabecera (no deja presupuestos vacíos) y propaga el error', async () => {
    sb.mock.respond('quotes', { data: { id: 'q1' } });
    sb.mock.respond('quote_items', { error: new Error('items') });

    await expect(createQuote(dto)).rejects.toThrow('items');

    const rollback = sb.mock.lastOps('quotes');
    expect(rollback[0]).toEqual(['update', [{ deleted: true, updated_by: 'device_test' }]]);
    expect(rollback).toContainEqual(['eq', ['id', 'q1']]);
  });

  it('si el número ya está en uso (23505) reintenta con el siguiente libre', async () => {
    sb.mock.respond('quotes', { error: { code: '23505', message: 'duplicate key' } }); // insert #7
    sb.mock.respond('quotes', { data: { quote_number: 9 } });                          // next number → 10
    sb.mock.respond('quotes', { data: { id: 'q1', quote_number: 10 } });               // insert #10

    const quote = await createQuote(dto);

    expect(quote.quote_number).toBe(10);
    const inserts = sb.mock.queries.filter((q) => q.table === 'quotes' && q.ops[0]?.[0] === 'insert');
    expect(inserts.map((q) => (q.ops[0][1][0] as { quote_number: number }).quote_number)).toEqual([7, 10]);
  });

  it('no reintenta para siempre: después de 3 conflictos propaga el error', async () => {
    for (let i = 0; i < 4; i++) {
      sb.mock.respond('quotes', { error: { code: '23505', message: 'duplicate key' } });
      if (i < 3) sb.mock.respond('quotes', { data: { quote_number: 40 + i } });
    }
    await expect(createQuote(dto)).rejects.toMatchObject({ code: '23505' });
  });

  it('otros errores (p. ej. límite del plan) no se reintentan', async () => {
    sb.mock.respond('quotes', { error: { code: 'P0001', message: 'plan_limit:max_quotes_per_month:20' } });
    await expect(createQuote(dto)).rejects.toMatchObject({ code: 'P0001' });
    expect(sb.mock.queries.filter((q) => q.table === 'quotes')).toHaveLength(1);
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

describe('getQuoteById', () => {
  it('no devuelve presupuestos borrados ni ítems reemplazados', async () => {
    sb.mock.respond('quotes', { data: { id: 'q1' } });
    await getQuoteById('q1');
    const ops = sb.mock.lastOps('quotes');
    expect(ops).toContainEqual(['eq', ['deleted', false]]);
    expect(ops).toContainEqual(['eq', ['items.deleted', false]]);
  });
});

describe('updateQuote', () => {
  const edited = { ...dto, quote_number: 8, items: [{ product: 'Cactus', quantity: 3, unit_price: 5, total_price: 15 }] };

  const updates = (table: string) =>
    sb.mock.queries.filter((q) => q.table === table && q.ops[0]?.[0] === 'update');

  it('inserta los ítems nuevos, da de baja los viejos y actualiza la cabecera', async () => {
    sb.mock.respond('quote_items', { data: [{ id: 'old1' }, { id: 'old2' }] }); // ítems actuales
    sb.mock.respond('quote_items', { data: [{ id: 'new1' }] });                 // insert

    await updateQuote('q1', edited);

    const insert = sb.mock.queries.find((q) => q.table === 'quote_items' && q.ops[0]?.[0] === 'insert')!;
    expect(insert.ops[0][1][0]).toEqual([expect.objectContaining({ product: 'Cactus', quote_id: 'q1', client_id: 'cl1' })]);

    const [softDelete] = updates('quote_items');
    expect(softDelete.ops).toContainEqual(['in', ['id', ['old1', 'old2']]]);
    expect(softDelete.ops[0][1][0]).toMatchObject({ deleted: true });

    const [headerUpdate] = updates('quotes');
    expect(headerUpdate.ops[0][1][0]).toMatchObject({ quote_number: 8, total_amount: 30, updated_by: 'device_test' });
    expect(headerUpdate.ops[0][1][0]).not.toHaveProperty('items');
    expect(headerUpdate.ops).toContainEqual(['eq', ['id', 'q1']]);
  });

  it('si falla el insert de ítems no toca nada más', async () => {
    sb.mock.respond('quote_items', { data: [{ id: 'old1' }] });
    sb.mock.respond('quote_items', { error: new Error('items') });
    await expect(updateQuote('q1', edited)).rejects.toThrow('items');
    expect(updates('quote_items')).toHaveLength(0);
    expect(updates('quotes')).toHaveLength(0);
  });

  it('si falla la cabecera (p. ej. número repetido) revierte los ítems', async () => {
    sb.mock.respond('quote_items', { data: [{ id: 'old1' }] });
    sb.mock.respond('quote_items', { data: [{ id: 'new1' }] });
    sb.mock.respond('quote_items', {});                                   // baja de viejos OK
    sb.mock.respond('quotes', { error: { code: '23505', message: 'dup' } });

    await expect(updateQuote('q1', edited)).rejects.toMatchObject({ code: '23505' });

    const itemUpdates = updates('quote_items');
    // 1) baja de viejos, 2) baja de nuevos (deshacer), 3) restaurar viejos
    expect(itemUpdates).toHaveLength(3);
    expect(itemUpdates[1].ops).toContainEqual(['in', ['id', ['new1']]]);
    expect(itemUpdates[2].ops[0][1][0]).toMatchObject({ deleted: false });
    expect(itemUpdates[2].ops).toContainEqual(['in', ['id', ['old1']]]);
  });
});
