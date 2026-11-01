import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithQuery } from '@/test/render';
import { permissionsFor } from '@/test/permissions';

const sb = vi.hoisted(() => ({ mock: null as unknown as ReturnType<typeof import('@/test/supabaseMock').createSupabaseMock> }));
vi.mock('@/lib/supabase', async () => {
  const { createSupabaseMock } = await import('@/test/supabaseMock');
  sb.mock = createSupabaseMock();
  return { supabase: sb.mock.client };
});
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }));
vi.mock('sonner', () => ({ toast }));
const perms = vi.hoisted(() => ({ value: null as unknown }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => perms.value }));

import { SaleForm } from './SaleForm';
import { ProductForm } from './ProductForm';
import { StockAdjustModal } from './StockAdjustModal';
import MetricsPage from '@/app/(backoffice)/metrics/page';
import type { Product } from '@/types/inventory';

const product = (over: Partial<Product>): Product => ({
  id: 'p1', name: 'Empanada', sku: null, unit: 'unidad', price: 1.5, stock_current: 10, stock_min: 2,
  created_at: '2026-11-01T00:00:00Z', updated_at: null, deleted: false, ...over,
});
const sellers = [
  { id: 'v1', name: 'Pedro', active: true,  created_at: '' },
  { id: 'v2', name: 'Ex',    active: false, created_at: '' },
];
const products = [product({}), product({ id: 'p2', name: 'Refresco', price: 2, stock_current: 2, stock_min: 2 })];

beforeEach(() => {
  sb.mock.reset();
  Object.values(toast).forEach((f) => f.mockClear());
  perms.value = permissionsFor('ventas:ver', 'ventas:crear', 'metricas:ver');
});

function renderSaleForm(props: Partial<React.ComponentProps<typeof SaleForm>> = {}) {
  sb.mock.respond('sellers',  { data: sellers });
  sb.mock.respond('products', { data: products });
  sb.mock.respond('clients',  { data: [{ id: 'c1', name: 'Ana' }] });
  const onClose = vi.fn();
  renderWithQuery(<SaleForm open onClose={onClose} {...props} />);
  return { onClose };
}

describe('SaleForm', () => {
  it('pide elegir vendedor y solo ofrece los activos', async () => {
    renderSaleForm();
    const seller = screen.getByLabelText(/Vendedor/);
    await screen.findByRole('option', { name: 'Pedro' });
    expect(within(seller).queryByRole('option', { name: 'Ex' })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Registrar venta' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Elegí quién hizo la venta.');
    expect(sb.mock.client.rpc).not.toHaveBeenCalled();
  });

  it('avisa si se pide más de lo que hay en stock (sumando líneas del mismo producto)', async () => {
    renderSaleForm();
    await screen.findByRole('option', { name: 'Pedro' });
    await userEvent.selectOptions(screen.getByLabelText(/Vendedor/), 'v1');
    await userEvent.selectOptions(screen.getByLabelText('Producto 1'), 'p2');
    await userEvent.click(screen.getByRole('button', { name: /Agregar otro producto/ }));
    await userEvent.selectOptions(screen.getByLabelText('Producto 2'), 'p2');
    await userEvent.clear(screen.getByLabelText('Cantidad 2'));
    await userEvent.type(screen.getByLabelText('Cantidad 2'), '2');

    expect(screen.getByText('Solo quedan 2 unidad.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Registrar venta' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Hay productos sin stock suficiente.');
    expect(sb.mock.client.rpc).not.toHaveBeenCalled();
  });

  it('registra la venta, muestra el total y avisa los productos que llegaron al mínimo', async () => {
    sb.mock.rpcRespond('register_sale', { data: {
      sale_id: 's1', total: 4.5,
      low_stock: [{ id: 'p2', name: 'Refresco', unit: 'unidad', stock_current: 1, stock_min: 2 }],
    } });
    const { onClose } = renderSaleForm({ clientId: 'c1' });
    await screen.findByRole('option', { name: 'Ana' });
    expect(screen.getByLabelText('Cliente')).toHaveValue('c1');

    await userEvent.selectOptions(screen.getByLabelText(/Vendedor/), 'v1');
    await userEvent.selectOptions(screen.getByLabelText('Producto 1'), 'p1');
    await userEvent.clear(screen.getByLabelText('Cantidad 1'));
    await userEvent.type(screen.getByLabelText('Cantidad 1'), '1,5');
    expect(screen.getByText('$ 2,25', { selector: 'span.text-lg' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: 'Pagada' }));
    await userEvent.click(screen.getByRole('button', { name: 'Registrar venta' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(sb.mock.client.rpc).toHaveBeenCalledWith('register_sale', expect.objectContaining({
      p_seller_id: 'v1', p_client_id: 'c1', p_status: 'paid', p_items: [{ product_id: 'p1', quantity: 1.5 }],
    }));
    expect(toast.success).toHaveBeenCalledWith('Venta registrada por $ 4,50');
    expect(toast.warning).toHaveBeenCalledWith('Quedan 1 de Refresco (mínimo 2). Hay que comprar más.', expect.anything());
  });

  it('muestra el error de la base en palabras', async () => {
    sb.mock.rpcRespond('register_sale', { error: { message: 'stock_insuficiente:Empanada:0.00' } });
    renderSaleForm();
    await screen.findByRole('option', { name: 'Pedro' });
    await userEvent.selectOptions(screen.getByLabelText(/Vendedor/), 'v1');
    await userEvent.selectOptions(screen.getByLabelText('Producto 1'), 'p1');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar venta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No hay stock suficiente de Empanada: quedan 0.');
  });
});

describe('SaleForm: crear producto sin salir de la venta', () => {
  it('sin productos ofrece crear el primero y lo deja seleccionado', async () => {
    perms.value = permissionsFor('ventas:ver', 'ventas:crear', 'productos:crear');
    sb.mock.respond('sellers',  { data: sellers });
    sb.mock.respond('products', { data: [] });
    sb.mock.respond('clients',  { data: [] });
    renderWithQuery(<SaleForm open onClose={vi.fn()} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Crear el primero' }));
    // el insert y la recarga de la lista
    const created = product({ id: 'p9', name: 'Empanada mixta', price: 2, stock_current: 12 });
    sb.mock.respond('products', { data: created });
    sb.mock.respond('products', { data: [created] });

    await userEvent.type(screen.getByLabelText(/^Nombre/), 'Empanada mixta');
    await userEvent.type(screen.getByLabelText(/^Precio/), '2');
    await userEvent.type(screen.getByLabelText('Stock actual'), '12');
    await userEvent.click(screen.getByRole('button', { name: 'Crear y agregar a la venta' }));

    await waitFor(() => expect(screen.getByLabelText('Producto 1')).toHaveValue('p9'));
    expect(sb.mock.queries.find((q) => q.table === 'products' && q.ops[0]?.[0] === 'insert')?.ops[0]).toEqual(['insert', [{
      name: 'Empanada mixta', sku: null, unit: 'unidad', price: 2, stock_current: 12, stock_min: 0,
    }]]);
    expect(toast.success).toHaveBeenCalledWith('Empanada mixta creado');
  });

  it('con productos también se puede crear uno nuevo; valida el nombre', async () => {
    perms.value = permissionsFor('ventas:ver', 'ventas:crear', 'productos:crear');
    renderSaleForm();
    await screen.findByRole('option', { name: 'Pedro' });
    await userEvent.click(screen.getByRole('button', { name: /Crear producto nuevo/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Crear y agregar a la venta' }));
    expect(screen.getByText('Poné un nombre.')).toBeInTheDocument();
    expect(sb.mock.queries.some((q) => q.ops[0]?.[0] === 'insert')).toBe(false);
  });

  it('sin permiso de productos no muestra la opción', async () => {
    sb.mock.respond('sellers',  { data: sellers });
    sb.mock.respond('products', { data: [] });
    renderWithQuery(<SaleForm open onClose={vi.fn()} />);
    expect(await screen.findByText(/Pedile a un administrador/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Crear/ })).toBeNull();
  });
});

describe('ProductForm', () => {
  it('crea con stock inicial y acepta precios con coma', async () => {
    sb.mock.respond('products', { data: product({}) });
    const onClose = vi.fn();
    renderWithQuery(<ProductForm open onClose={onClose} />);

    await userEvent.click(screen.getByRole('button', { name: 'Crear producto' }));
    expect(screen.getByText('Poné un nombre.')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/Nombre/), 'Empanada de pollo');
    await userEvent.type(screen.getByLabelText(/Precio/), '1,50');
    await userEvent.type(screen.getByLabelText('Stock actual'), '30');
    await userEvent.type(screen.getByLabelText('Stock mínimo'), '5');
    await userEvent.click(screen.getByRole('button', { name: 'Crear producto' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(sb.mock.lastOps('products')[0]).toEqual(['insert', [{
      name: 'Empanada de pollo', sku: null, unit: 'unidad', price: 1.5, stock_min: 5, stock_current: 30,
    }]]);
  });

  it('al editar no deja cambiar el stock (solo con compras, ajustes o ventas)', async () => {
    const onClose = vi.fn();
    renderWithQuery(<ProductForm open onClose={onClose} product={product({ stock_current: 7 })} />);
    expect(screen.getByLabelText('Stock actual')).toBeDisabled();
    await userEvent.clear(screen.getByLabelText('Stock mínimo'));
    await userEvent.type(screen.getByLabelText('Stock mínimo'), '3');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const [method, [payload]] = sb.mock.lastOps('products')[0] as [string, [Record<string, unknown>]];
    expect(method).toBe('update');
    expect(payload).toMatchObject({ stock_min: 3 });
    expect(payload).not.toHaveProperty('stock_current');
  });

  it('rechaza un precio inválido', async () => {
    renderWithQuery(<ProductForm open onClose={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/Nombre/), 'X');
    await userEvent.type(screen.getByLabelText(/Precio/), 'abc');
    await userEvent.click(screen.getByRole('button', { name: 'Crear producto' }));
    expect(screen.getByText('Precio inválido (ej: 1,50).')).toBeInTheDocument();
    expect(sb.mock.queries.some((q) => q.table === 'products')).toBe(false);
  });
});

describe('StockAdjustModal', () => {
  it('compra: suma lo que entró', async () => {
    sb.mock.rpcRespond('adjust_stock', { data: 15 });
    const onClose = vi.fn();
    renderWithQuery(<StockAdjustModal product={product({ stock_current: 5 })} onClose={onClose} />);
    await userEvent.type(screen.getByLabelText(/¿Cuánto entró\?/), '10');
    expect(screen.getByText('Va a quedar en 15 unidad.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(sb.mock.client.rpc).toHaveBeenCalledWith('adjust_stock', expect.objectContaining({ p_quantity: 10, p_kind: 'purchase' }));
  });

  it('corregir conteo: manda la diferencia con lo que hay', async () => {
    sb.mock.rpcRespond('adjust_stock', { data: 3 });
    renderWithQuery(<StockAdjustModal product={product({ stock_current: 5 })} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Corregir conteo' }));
    await userEvent.type(screen.getByLabelText(/¿Cuánto hay realmente\?/), '3');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(sb.mock.client.rpc).toHaveBeenCalledWith('adjust_stock', expect.objectContaining({ p_quantity: -2, p_kind: 'adjustment' })));
  });
});

describe('MetricsPage', () => {
  it('muestra totales y el ranking de vendedores', async () => {
    sb.mock.rpcRespond('sales_metrics', { data: {
      totals: { sales: 3, revenue: 30, pending: 10, units: 12 },
      sellers: [
        { id: 'v1', name: 'Pedro', active: true, sales: 2, revenue: 25, units: 10 },
        { id: 'v2', name: 'Lucía', active: true, sales: 1, revenue: 5,  units: 2  },
      ],
      products: [{ id: 'p1', name: 'Empanada', unit: 'unidad', units: 12, revenue: 30 }],
      daily: [{ day: '2026-11-01', sales: 3, revenue: 30 }],
    } });
    renderWithQuery(<MetricsPage />);

    expect(await screen.findByText('Pedro')).toBeInTheDocument();
    expect(screen.getByText('A cobrar').nextSibling).toHaveTextContent('$ 10,00');
    expect(screen.getByText('prom. $ 12,50')).toBeInTheDocument();
    const names = screen.getAllByText(/^(Pedro|Lucía)$/).map((n) => n.textContent);
    expect(names).toEqual(['Pedro', 'Lucía']);
    expect(sb.mock.client.rpc).toHaveBeenCalledWith('sales_metrics', expect.objectContaining({ p_from: expect.any(String), p_to: expect.any(String) }));
  });

  it('sin permiso no consulta nada', () => {
    perms.value = permissionsFor('ventas:ver');
    renderWithQuery(<MetricsPage />);
    expect(screen.getByText('No tenés acceso a las métricas')).toBeInTheDocument();
    expect(sb.mock.client.rpc).not.toHaveBeenCalled();
  });
});
