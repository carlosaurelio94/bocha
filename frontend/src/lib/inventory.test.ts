import { describe, it, expect, vi, beforeEach } from 'vitest';

const sb = vi.hoisted(() => ({ mock: null as unknown as ReturnType<typeof import('@/test/supabaseMock').createSupabaseMock> }));
vi.mock('./supabase', async () => {
  const { createSupabaseMock } = await import('@/test/supabaseMock');
  sb.mock = createSupabaseMock();
  return { supabase: sb.mock.client };
});

import {
  formatQty, stockLevel, lowStockMessage, inventoryErrorMessage, presetRange,
  registerSale, getProducts, getSalesMetrics, getClientBalance, adjustStock,
} from './inventory';

beforeEach(() => sb.mock.reset());

describe('formatQty', () => {
  it('no muestra decimales de más', () => {
    expect(formatQty(3)).toBe('3');
    expect(formatQty(2.5)).toBe('2,5');
    expect(formatQty(1.25)).toBe('1,25');
  });
});

describe('stockLevel', () => {
  it.each([
    [{ stock_current: 0,  stock_min: 5 }, 'out'],
    [{ stock_current: 5,  stock_min: 5 }, 'low'],
    [{ stock_current: 3,  stock_min: 5 }, 'low'],
    [{ stock_current: 6,  stock_min: 5 }, 'ok'],
    [{ stock_current: 1,  stock_min: 0 }, 'ok'],
  ])('%o → %s', (p, level) => {
    expect(stockLevel(p)).toBe(level);
  });
});

describe('lowStockMessage', () => {
  it('avisa que hay que comprar, con cantidades', () => {
    expect(lowStockMessage({ id: '1', name: 'Refresco', unit: 'unidad', stock_current: 2, stock_min: 5 }))
      .toBe('Quedan 2 de Refresco (mínimo 5). Hay que comprar más.');
    expect(lowStockMessage({ id: '1', name: 'Refresco', unit: 'unidad', stock_current: 0, stock_min: 5 }))
      .toBe('Refresco se quedó sin stock. Hay que comprar más.');
  });
});

describe('inventoryErrorMessage', () => {
  it.each([
    [{ message: 'stock_insuficiente:Empanada de carne:2.00' }, 'No hay stock suficiente de Empanada de carne: quedan 2.'],
    [{ message: 'stock_negativo:3.50' }, 'El stock no puede quedar negativo (hay 3,5).'],
    [{ message: 'vendedor_invalido' }, 'El vendedor no existe o está inactivo.'],
    [{ message: 'sin_permiso:ventas:crear', code: '42501' }, 'No tenés permiso para hacer esto.'],
    [{ message: 'duplicate key value', code: '23505' }, 'Ya existe uno con ese nombre.'],
    [{ message: 'algo raro de postgres' }, 'fallback'],
  ])('%o', (error, expected) => {
    expect(inventoryErrorMessage(error, 'fallback')).toBe(expected);
  });

  it('un nombre de producto con ":" no rompe el mensaje', () => {
    expect(inventoryErrorMessage({ message: 'stock_insuficiente:Pack 2:1:0.00' }, 'x'))
      .toBe('No hay stock suficiente de Pack 2:1: quedan 0.');
  });
});

describe('presetRange', () => {
  const today = new Date(2026, 10, 15); // 15 nov 2026

  it.each([
    ['month',      { from: '2026-11-01', to: '2026-11-30' }],
    ['last_month', { from: '2026-10-01', to: '2026-10-31' }],
    ['7d',         { from: '2026-11-09', to: '2026-11-15' }],
    ['30d',        { from: '2026-10-17', to: '2026-11-15' }],
    ['year',       { from: '2026-01-01', to: '2026-12-31' }],
  ] as const)('%s', (preset, expected) => {
    expect(presetRange(preset, today)).toEqual(expected);
  });

  it('mes pasado en enero es diciembre del año anterior', () => {
    expect(presetRange('last_month', new Date(2027, 0, 10))).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });
});

describe('registerSale', () => {
  it('llama a la RPC con los parámetros y normaliza la respuesta', async () => {
    sb.mock.rpcRespond('register_sale', { data: { sale_id: 's1', total: '24.50', low_stock: null } });
    const result = await registerSale({
      seller_id: 'v1', client_id: null, sale_date: '2026-11-01', status: 'pending', notes: null,
      items: [{ product_id: 'p1', quantity: 2 }],
    });
    expect(sb.mock.client.rpc).toHaveBeenCalledWith('register_sale', {
      p_seller_id: 'v1', p_items: [{ product_id: 'p1', quantity: 2 }], p_client_id: null,
      p_sale_date: '2026-11-01', p_status: 'pending', p_notes: null,
    });
    expect(result).toEqual({ sale_id: 's1', total: 24.5, low_stock: [] });
  });

  it('propaga el error de la base', async () => {
    sb.mock.rpcRespond('register_sale', { error: { message: 'stock_insuficiente:X:0.00' } });
    await expect(registerSale({ seller_id: 'v1', client_id: null, sale_date: '2026-11-01', status: 'paid', notes: null, items: [] }))
      .rejects.toMatchObject({ message: 'stock_insuficiente:X:0.00' });
  });
});

describe('adjustStock', () => {
  it('manda la nota vacía como null', async () => {
    sb.mock.rpcRespond('adjust_stock', { data: 12 });
    await expect(adjustStock({ productId: 'p1', quantity: 10, kind: 'purchase', notes: '  ' })).resolves.toBe(12);
    expect(sb.mock.client.rpc).toHaveBeenCalledWith('adjust_stock', { p_product_id: 'p1', p_quantity: 10, p_kind: 'purchase', p_notes: null });
  });
});

describe('getProducts', () => {
  it('lista los no eliminados ordenados por nombre', async () => {
    sb.mock.respond('products', { data: [{ id: 'p1' }] });
    await getProducts();
    expect(sb.mock.lastOps('products')).toEqual(expect.arrayContaining([
      ['eq', ['deleted', false]], ['order', ['name']],
    ]));
  });

  it('"Comprar más" usa la vista de stock bajo', async () => {
    sb.mock.respond('low_stock_products', { data: [{ id: 'p2' }] });
    sb.mock.respond('products', { data: [{ id: 'p2', name: 'Refresco' }] });
    const rows = await getProducts({ lowOnly: true });
    expect(rows).toEqual([{ id: 'p2', name: 'Refresco' }]);
    expect(sb.mock.lastOps('products')).toContainEqual(['in', ['id', ['p2']]]);
  });

  it('sin productos en stock bajo no hace la segunda consulta', async () => {
    sb.mock.respond('low_stock_products', { data: [] });
    expect(await getProducts({ lowOnly: true })).toEqual([]);
    expect(sb.mock.queries.some((q) => q.table === 'products')).toBe(false);
  });
});

describe('getSalesMetrics', () => {
  it('convierte los numéricos que llegan como string', async () => {
    sb.mock.rpcRespond('sales_metrics', { data: {
      totals: { sales: 2, revenue: '28.50', pending: '24.50', units: '18.00' },
      sellers: [{ id: 'v1', name: 'Pedro', active: true, sales: 1, revenue: '24.50', units: '16' }],
      products: [], daily: null,
    } });
    const m = await getSalesMetrics('2026-11-01', '2026-11-30');
    expect(m.totals).toEqual({ sales: 2, revenue: 28.5, pending: 24.5, units: 18 });
    expect(m.sellers[0]).toMatchObject({ name: 'Pedro', revenue: 24.5, units: 16 });
    expect(m.daily).toEqual([]);
  });
});

describe('getClientBalance', () => {
  it('suma las ventas a cuenta del cliente', async () => {
    sb.mock.respond('sales', { data: [{ total: '10.50' }, { total: 4 }] });
    expect(await getClientBalance('c1')).toEqual({ pending: 14.5, count: 2 });
    expect(sb.mock.lastOps('sales')).toEqual(expect.arrayContaining([
      ['eq', ['status', 'pending']], ['eq', ['client_id', 'c1']], ['eq', ['deleted', false]],
    ]));
  });
});
