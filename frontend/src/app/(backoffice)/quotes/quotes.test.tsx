import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithQuery } from '@/test/render';
import { createSupabaseMock } from '@/test/supabaseMock';
import { permissionsFor, ALL_PERMISSIONS } from '@/test/permissions';

const sb = vi.hoisted(() => ({ mock: null as unknown as ReturnType<typeof createSupabaseMock> }));
vi.mock('@/lib/supabase', async () => {
  const { createSupabaseMock } = await import('@/test/supabaseMock');
  sb.mock = createSupabaseMock();
  return { supabase: sb.mock.client };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const nav = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn(), back: vi.fn() },
  params: new URLSearchParams(),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => nav.router,
  useSearchParams: () => nav.params,
}));

const perms = vi.hoisted(() => ({ value: null as unknown }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => perms.value }));

import QuotesPage from './page';

const quote = (i: number, status: string) => ({
  id: `q${i}`, quote_number: i, quote_date: '2026-10-01', total_amount: 100 * i, item_count: i,
  currency: '$', status, client_id: `c${i}`, client: { id: `c${i}`, name: `Cliente ${i}` },
});

beforeEach(() => {
  sb.mock.reset();
  nav.router.push.mockClear();
  nav.router.replace.mockClear();
  nav.params = new URLSearchParams();
  perms.value = permissionsFor(...ALL_PERMISSIONS);
});

const desktopTable = () => screen.getByRole('table');

describe('QuotesPage', () => {
  it('lista presupuestos con número, cliente y total', async () => {
    sb.mock.respond('quotes', { data: [quote(1, 'draft'), quote(2, 'sent')], count: 2 });
    renderWithQuery(<QuotesPage />);

    const table = await screen.findByRole('table');
    expect(within(table).getByText('#0001')).toBeInTheDocument();
    expect(within(table).getByText('Cliente 2')).toBeInTheDocument();
    expect(within(table).getByText('$ 200,00')).toBeInTheDocument();
    expect(screen.getByText('2 presupuestos')).toBeInTheDocument();
  });

  it('muestra el estado vacío con CTA cuando no hay nada', async () => {
    sb.mock.respond('quotes', { data: [], count: 0 });
    renderWithQuery(<QuotesPage />);
    expect(await screen.findByText('Todavía no hay presupuestos')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Crear el primero/ })).toHaveAttribute('href', '/quotes/new');
  });

  it('muestra error si falla la carga', async () => {
    sb.mock.respond('quotes', { error: new Error('x') });
    renderWithQuery(<QuotesPage />);
    expect(await screen.findByText(/No pudimos cargar los presupuestos/)).toBeInTheDocument();
  });

  it('respeta ?estado=sent al entrar (link desde el dashboard)', async () => {
    nav.params = new URLSearchParams('estado=sent');
    renderWithQuery(<QuotesPage />);
    await waitFor(() => expect(sb.mock.lastOps('quotes')).toContainEqual(['eq', ['status', 'sent']]));
    expect(screen.getByRole('button', { name: 'Sin respuesta' })).toHaveClass('bg-gray-900');
  });

  it('ignora un ?estado inválido', async () => {
    nav.params = new URLSearchParams('estado=hackeado');
    renderWithQuery(<QuotesPage />);
    await waitFor(() => expect(sb.mock.queries.length).toBeGreaterThan(0));
    expect(sb.mock.lastOps('quotes').some(([m, a]) => m === 'eq' && a[0] === 'status')).toBe(false);
  });

  it('filtrar por pestaña consulta ese estado y actualiza la URL', async () => {
    renderWithQuery(<QuotesPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Aprobados' }));
    await waitFor(() => expect(sb.mock.lastOps('quotes')).toContainEqual(['eq', ['status', 'approved']]));
    expect(nav.router.replace).toHaveBeenCalledWith('/quotes?estado=approved', { scroll: false });
  });

  it('la búsqueda espera a que se deje de escribir', async () => {
    renderWithQuery(<QuotesPage />);
    await waitFor(() => expect(sb.mock.queries.length).toBe(1));

    await userEvent.type(screen.getByPlaceholderText('Buscar por cliente'), 'ana');
    expect(sb.mock.queries.filter((q) => q.ops.some(([m]) => m === 'ilike'))).toHaveLength(0);

    await waitFor(() => expect(sb.mock.lastOps('quotes')).toContainEqual(['ilike', ['clients.name', '%ana%']]));
    // una sola consulta con búsqueda, no una por tecla
    expect(sb.mock.queries.filter((q) => q.ops.some(([m]) => m === 'ilike'))).toHaveLength(1);
  });

  it('click en una fila abre el detalle', async () => {
    sb.mock.respond('quotes', { data: [quote(5, 'sent')], count: 1 });
    renderWithQuery(<QuotesPage />);
    await userEvent.click(await within(await screen.findByRole('table')).findByText('Cliente 5'));
    expect(nav.router.push).toHaveBeenCalledWith('/quotes/q5');
  });

  it('cambia el estado desde la lista', async () => {
    sb.mock.respond('quotes', { data: [quote(1, 'draft')], count: 1 });
    renderWithQuery(<QuotesPage />);
    await userEvent.selectOptions(await within(await screen.findByRole('table')).findByLabelText('Cambiar estado'), 'sent');
    await waitFor(() => expect(sb.mock.queries.some((q) =>
      q.ops[0]?.[0] === 'update' && (q.ops[0][1][0] as { status?: string }).status === 'sent')).toBe(true));
  });

  it('pide confirmación antes de eliminar', async () => {
    sb.mock.respond('quotes', { data: [quote(3, 'draft')], count: 1 });
    renderWithQuery(<QuotesPage />);

    await userEvent.click(await screen.findByLabelText('Eliminar presupuesto #0003'));
    const dialog = screen.getByRole('dialog', { name: 'Eliminar presupuesto' });
    expect(within(dialog).getByText('Cliente 3')).toBeInTheDocument();
    expect(sb.mock.queries.some((q) => q.table === 'quote_items')).toBe(false);

    await userEvent.click(within(dialog).getByRole('button', { name: 'Sí, eliminar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(sb.mock.lastOps('quote_items')).toContainEqual(['eq', ['quote_id', 'q3']]);
  });

  it('un usuario de solo lectura no ve crear, eliminar ni cambiar estado', async () => {
    perms.value = permissionsFor('presupuestos:ver');
    sb.mock.respond('quotes', { data: [quote(1, 'draft')], count: 1 });
    renderWithQuery(<QuotesPage />);

    await screen.findByRole('table');
    expect(screen.queryByRole('link', { name: /Nuevo presupuesto/ })).toBeNull();
    expect(screen.queryByLabelText(/Eliminar presupuesto/)).toBeNull();
    expect(within(desktopTable()).queryByLabelText('Cambiar estado')).toBeNull();
  });
});
