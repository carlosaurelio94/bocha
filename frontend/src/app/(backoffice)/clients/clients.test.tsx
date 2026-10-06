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
  router: { push: vi.fn(), replace: vi.fn() },
  params: new URLSearchParams(),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => nav.router,
  useSearchParams: () => nav.params,
}));

const perms = vi.hoisted(() => ({ value: null as unknown }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => perms.value }));

import ClientsPage from './page';

const client = (i: number, status: 'client' | 'prospect') => ({
  id: `c${i}`, name: `Cliente ${i}`, rif: null, phone: `0412-${i}`, address: null,
  client_status: status, created_at: '2026-01-01', deleted: false,
});

beforeEach(() => {
  sb.mock.reset();
  nav.router.push.mockClear();
  nav.router.replace.mockClear();
  nav.params = new URLSearchParams();
  perms.value = permissionsFor(...ALL_PERMISSIONS);
});

describe('ClientsPage', () => {
  it('lista los clientes con su estado', async () => {
    sb.mock.respond('clients', { data: [client(1, 'client'), client(2, 'prospect')], count: 2 });
    renderWithQuery(<ClientsPage />);

    const table = await screen.findByRole('table');
    expect(within(table).getByText('Cliente 1')).toBeInTheDocument();
    expect(within(table).getByText('Prospecto')).toBeInTheDocument();
    expect(screen.getByText('2 registros')).toBeInTheDocument();
  });

  it('estado vacío sin filtros invita a crear el primero', async () => {
    sb.mock.respond('clients', { data: [], count: 0 });
    renderWithQuery(<ClientsPage />);
    await userEvent.click(await screen.findByRole('button', { name: /Crear el primero/ }));
    expect(screen.getByRole('dialog', { name: 'Nuevo cliente' })).toBeInTheDocument();
  });

  it('estado vacío con filtros permite limpiarlos', async () => {
    renderWithQuery(<ClientsPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Prospectos' }));
    await waitFor(() => expect(sb.mock.lastOps('clients')).toContainEqual(['eq', ['client_status', 'prospect']]));

    await userEvent.click(await screen.findByRole('button', { name: 'Limpiar filtros' }));
    await waitFor(() => expect(sb.mock.lastOps('clients').some(([m, a]) => m === 'eq' && a[0] === 'client_status')).toBe(false));
  });

  it('?nuevo=1 abre directamente el formulario y limpia la URL', async () => {
    nav.params = new URLSearchParams('nuevo=1');
    renderWithQuery(<ClientsPage />);
    expect(screen.getByRole('dialog', { name: 'Nuevo cliente' })).toBeInTheDocument();
    await waitFor(() => expect(nav.router.replace).toHaveBeenCalledWith('/clients', { scroll: false }));
  });

  it('editar abre el formulario con los datos del cliente', async () => {
    sb.mock.respond('clients', { data: [client(7, 'client')], count: 1 });
    renderWithQuery(<ClientsPage />);
    await userEvent.click(await screen.findByLabelText('Editar Cliente 7'));
    expect(screen.getByRole('dialog', { name: 'Editar cliente' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Nombre/)).toHaveValue('Cliente 7');
    expect(nav.router.push).not.toHaveBeenCalled();
  });

  it('eliminar pide confirmación y hace borrado lógico', async () => {
    sb.mock.respond('clients', { data: [client(4, 'client')], count: 1 });
    renderWithQuery(<ClientsPage />);
    await userEvent.click(await screen.findByLabelText('Eliminar Cliente 4'));

    const dialog = screen.getByRole('dialog', { name: 'Eliminar cliente' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Sí, eliminar' }));
    await waitFor(() => expect(sb.mock.queries.some((q) =>
      q.ops[0]?.[0] === 'update' && (q.ops[0][1][0] as { deleted?: boolean }).deleted === true)).toBe(true));
  });

  it('sin permisos de escritura solo se puede mirar', async () => {
    perms.value = permissionsFor('clientes:ver');
    sb.mock.respond('clients', { data: [client(1, 'client')], count: 1 });
    renderWithQuery(<ClientsPage />);
    await screen.findByRole('table');
    expect(screen.queryByRole('button', { name: /Nuevo cliente/ })).toBeNull();
    expect(screen.queryByLabelText(/Editar/)).toBeNull();
    expect(screen.queryByLabelText(/Eliminar/)).toBeNull();
  });

  it('pagina cuando hay más de 15 clientes', async () => {
    sb.mock.respond('clients', { data: [client(1, 'client')], count: 40 });
    sb.mock.respond('clients', { data: [client(16, 'client')], count: 40 });
    renderWithQuery(<ClientsPage />);
    await userEvent.click(await screen.findByLabelText('Página siguiente'));
    await waitFor(() => expect(sb.mock.lastOps('clients')).toContainEqual(['range', [15, 29]]));
  });
});
