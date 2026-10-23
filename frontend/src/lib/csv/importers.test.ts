import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSupabaseMock } from '@/test/supabaseMock';

const sb = vi.hoisted(() => ({ mock: null as unknown as ReturnType<typeof createSupabaseMock> }));
vi.mock('@/lib/supabase', async () => {
  const { createSupabaseMock } = await import('@/test/supabaseMock');
  sb.mock = createSupabaseMock();
  return { supabase: sb.mock.client };
});

import { loadClientsContext, loadQuotesContext, importClients, importQuotes } from './importers';

beforeEach(() => {
  sb.mock.reset();
  localStorage.setItem('device_id', 'device_test');
});

describe('contextos', () => {
  it('pagina más allá de las 1000 filas de PostgREST para no perder duplicados', async () => {
    const page1 = Array.from({ length: 1000 }, (_, i) => ({ name: `Cliente ${i}`, rif: `J-${i}` }));
    sb.mock.respond('clients', { data: page1 });
    sb.mock.respond('clients', { data: [{ name: 'Último', rif: 'J-9999' }] });

    const ctx = await loadClientsContext();

    expect(ctx.existingRifs.size).toBe(1001);
    expect(ctx.existingRifs.has('J9999')).toBe(true);
    const ranges = sb.mock.queries.filter((q) => q.table === 'clients').map((q) => q.ops.find(([m]) => m === 'range')?.[1]);
    expect(ranges).toEqual([[0, 999], [1000, 1999]]);
  });

  it('calcula cuántos clientes más permite el plan', async () => {
    sb.mock.respond('clients', { data: [{ name: 'A', rif: null }, { name: 'B', rif: null }] });
    sb.mock.rpcRespond('company_limit', { data: 25 });
    expect((await loadClientsContext('co1')).remaining).toBe(23);
  });

  it('sin límite (enterprise), sin empresa o con una respuesta que no es un número, no limita', async () => {
    sb.mock.rpcRespond('company_limit', { data: null });
    expect((await loadClientsContext('co1')).remaining).toBeNull();
    expect((await loadClientsContext()).remaining).toBeNull();
    // Antes una respuesta inesperada ([]) se leía como 0 y bloqueaba toda importación
    sb.mock.rpcRespond('company_limit', { data: [] });
    expect((await loadClientsContext('co1')).remaining).toBeNull();
    sb.mock.rpcRespond('company_limit', { error: { message: 'x' } });
    expect((await loadClientsContext('co1')).remaining).toBeNull();
  });

  it('presupuestos: incluye números de borrados (el índice único los cuenta) y el uso del mes', async () => {
    sb.mock.respond('clients', { data: [{ id: 'c1', name: 'Ana', rif: null }] });
    sb.mock.respond('quotes', { data: [{ quote_number: 1 }, { quote_number: 2 }] });
    sb.mock.respond('quotes', { count: 18 });
    sb.mock.rpcRespond('company_limit', { data: 20 });

    const ctx = await loadQuotesContext('co1');

    expect([...ctx.existingNumbers]).toEqual([1, 2]);
    expect(ctx.remainingThisMonth).toBe(2);
    const numbersQuery = sb.mock.queries.find((q) => q.table === 'quotes' && q.ops.some(([m, a]) => m === 'select' && a[0] === 'quote_number'))!;
    expect(numbersQuery.ops.some(([m, a]) => m === 'eq' && a[0] === 'deleted')).toBe(false);
  });
});

describe('importación', () => {
  it('inserta clientes en bloques de 100', async () => {
    const rows = Array.from({ length: 250 }, (_, i) => ({ line: i + 2, value: { name: `C${i}`, rif: null, phone: null, address: null, client_status: 'prospect' as const } }));
    const progress = vi.fn();

    const out = await importClients(rows, progress);

    expect(out).toEqual({ imported: 250, failed: [] });
    const sizes = sb.mock.queries.filter((q) => q.table === 'clients').map((q) => (q.ops[0][1][0] as unknown[]).length);
    expect(sizes).toEqual([100, 100, 50]);
    expect(progress).toHaveBeenLastCalledWith(250, 250);
  });

  it('un presupuesto que falla no frena a los demás y queda informado', async () => {
    const item = (n: number) => ({ line: n, value: {
      quote_number: n, client_id: 'c1', client_name: 'Ana', quote_date: '2026-10-15', currency: '$' as const,
      status: 'draft' as const, product: 'P', quantity: 1, unit_price: 10 } });
    sb.mock.respond('quotes', { error: { code: 'P0001', message: 'plan_limit:max_quotes_per_month:20' } });
    sb.mock.respond('quotes', { data: { id: 'q2', quote_number: 2 } });

    const out = await importQuotes([item(1), item(2)]);

    expect(out.imported).toBe(1);
    expect(out.failed).toEqual([{ label: '#0001 · Ana', message: expect.stringMatching(/20 presupuestos por mes/) }]);
  });
});
