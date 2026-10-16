import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Suspense } from 'react';
import { renderWithQuery } from '@/test/render';
import { createSupabaseMock } from '@/test/supabaseMock';
import { permissionsFor, ALL_PERMISSIONS } from '@/test/permissions';

const sb = vi.hoisted(() => ({ mock: null as unknown as ReturnType<typeof createSupabaseMock> }));
vi.mock('@/lib/supabase', async () => {
  const { createSupabaseMock } = await import('@/test/supabaseMock');
  sb.mock = createSupabaseMock();
  return { supabase: sb.mock.client };
});
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
const perms = vi.hoisted(() => ({ value: null as unknown }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => perms.value }));

import EditQuotePage from './page';

const quote = {
  id: 'q1', client_id: 'c2', information_id: null, quote_number: 7, quote_date: '2026-10-01',
  total_amount: 75, item_count: 2, currency: '$', status: 'sent', updated_at: null,
  client: { id: 'c2', name: 'Hotel Las Palmas' }, information: null,
  items: [
    { id: 'i1', product: 'Ficus', quantity: 1, unit_price: 25, total_price: 25 },
    { id: 'i2', product: 'Palma', quantity: 2, unit_price: 25, total_price: 50 },
  ],
};

async function renderEdit() {
  sb.mock.respond('quotes', { data: quote });
  sb.mock.respond('clients', { data: [{ id: 'c1', name: 'Ana' }, { id: 'c2', name: 'Hotel Las Palmas' }], count: 2 });
  await act(async () => {
    renderWithQuery(<Suspense fallback={null}><EditQuotePage params={Promise.resolve({ id: 'q1' })} /></Suspense>);
  });
}

const products = () => screen.getAllByPlaceholderText('Ej: Planta ornamental 40cm') as HTMLInputElement[];

beforeEach(() => {
  sb.mock.reset();
  router.push.mockClear();
  toast.success.mockClear(); toast.error.mockClear();
  perms.value = permissionsFor(...ALL_PERMISSIONS);
  localStorage.setItem('device_id', 'device_test');
});

describe('EditQuotePage', () => {
  it('carga el presupuesto existente en el formulario', async () => {
    await renderEdit();
    expect(await screen.findByRole('heading', { name: 'Editar presupuesto #0007' })).toBeInTheDocument();
    expect(products().map((i) => i.value)).toEqual(['Ficus', 'Palma']);
    await waitFor(() => expect(screen.getAllByRole('combobox')[0]).toHaveValue('c2'));
    expect(screen.getByLabelText(/N° de presupuesto/)).toHaveValue(7);
    expect(screen.getByText('$ 75,00', { selector: '.text-xl' })).toBeInTheDocument();
  });

  it('no pide el "siguiente número": respeta el del presupuesto', async () => {
    await renderEdit();
    await screen.findByRole('heading', { name: /Editar presupuesto/ });
    const numberQuery = sb.mock.queries.find((q) => q.ops.some(([m, a]) => m === 'select' && a[0] === 'quote_number'));
    expect(numberQuery).toBeUndefined();
  });

  it('guarda los cambios y vuelve al detalle', async () => {
    await renderEdit();
    await screen.findByRole('heading', { name: /Editar presupuesto/ });

    const row = within(screen.getAllByRole('list')[0]).getAllByRole('listitem')[0];
    const [qty] = within(row).getAllByRole('spinbutton');
    await userEvent.clear(qty);
    await userEvent.type(qty, '4');

    sb.mock.respond('quote_items', { data: [{ id: 'i1' }, { id: 'i2' }] });
    sb.mock.respond('quote_items', { data: [{ id: 'n1' }, { id: 'n2' }] });
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/quotes/q1'));
    expect(toast.success).toHaveBeenCalledWith('Presupuesto actualizado');
    const header = sb.mock.queries.find((q) => q.table === 'quotes' && q.ops[0]?.[0] === 'update')!;
    expect(header.ops[0][1][0]).toMatchObject({ total_amount: 150, item_count: 2, quote_number: 7, client_id: 'c2' });
  });

  it('si el número elegido ya existe lo explica', async () => {
    await renderEdit();
    await screen.findByRole('heading', { name: /Editar presupuesto/ });
    sb.mock.respond('quote_items', { data: [] });
    sb.mock.respond('quote_items', { data: [{ id: 'n1' }] });
    sb.mock.respond('quote_items', {});
    sb.mock.respond('quotes', { error: { code: '23505', message: 'duplicate key' } });

    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Ese número de presupuesto ya está en uso'));
    expect(router.push).not.toHaveBeenCalled();
  });

  it('sin permiso de edición muestra un aviso en vez del formulario', async () => {
    perms.value = permissionsFor('presupuestos:ver');
    await renderEdit();
    expect(await screen.findByText('No tenés permiso para editar presupuestos')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar cambios' })).toBeNull();
  });
});
