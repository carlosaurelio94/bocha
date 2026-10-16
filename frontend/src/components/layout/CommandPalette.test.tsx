import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithQuery } from '@/test/render';
import { permissionsFor, ALL_PERMISSIONS } from '@/test/permissions';

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const perms = vi.hoisted(() => ({ value: null as unknown }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => perms.value }));

const getClients = vi.hoisted(() => vi.fn());
vi.mock('@/lib/clients', () => ({ getClients }));

import { CommandPalette } from './CommandPalette';

beforeEach(() => {
  router.push.mockClear();
  getClients.mockReset();
  getClients.mockResolvedValue({ data: [], total: 0 });
  perms.value = permissionsFor(...ALL_PERMISSIONS);
});

const labels = () => screen.getAllByRole('option').map((o) => o.textContent);

describe('CommandPalette', () => {
  it('cerrado no renderiza nada', () => {
    renderWithQuery(<CommandPalette open={false} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('lista acciones rápidas y secciones, y enfoca el buscador', async () => {
    renderWithQuery(<CommandPalette open onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveFocus());
    expect(labels()[0]).toContain('Nuevo presupuesto');
    expect(labels()).toEqual(expect.arrayContaining([expect.stringContaining('Clientes')]));
  });

  it('solo ofrece lo que el usuario tiene permitido', () => {
    perms.value = permissionsFor('dashboard:ver', 'clientes:ver');
    renderWithQuery(<CommandPalette open onClose={vi.fn()} />);
    const all = labels().join('|');
    expect(all).not.toContain('Nuevo presupuesto');
    expect(all).not.toContain('Nuevo cliente');
    expect(all).not.toContain('Facturas');
    expect(all).toContain('Clientes');
  });

  it('filtra sin importar mayúsculas ni tildes, y por palabras clave', async () => {
    renderWithQuery(<CommandPalette open onClose={vi.fn()} />);
    await userEvent.type(screen.getByRole('combobox'), 'CONFIGURACION');
    expect(labels()).toEqual([expect.stringContaining('Configuración')]);

    await userEvent.clear(screen.getByRole('combobox'));
    await userEvent.type(screen.getByRole('combobox'), 'cotizacion');
    expect(labels().join('|')).toContain('Presupuestos');
  });

  it('muestra un mensaje si no hay resultados', async () => {
    renderWithQuery(<CommandPalette open onClose={vi.fn()} />);
    await userEvent.type(screen.getByRole('combobox'), 'zzzz');
    expect(screen.getByText(/Sin resultados/)).toBeInTheDocument();
  });

  it('se navega con flechas y Enter ejecuta el seleccionado', async () => {
    const onClose = vi.fn();
    renderWithQuery(<CommandPalette open onClose={onClose} />);
    const input = screen.getByRole('combobox');
    await userEvent.click(input);

    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{ArrowUp}{ArrowUp}');
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');

    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(onClose).toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith('/clients?nuevo=1');
  });

  it('Escape cierra', async () => {
    const onClose = vi.fn();
    renderWithQuery(<CommandPalette open onClose={onClose} />);
    await userEvent.type(screen.getByRole('combobox'), '{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('busca clientes por nombre desde 2 caracteres y abre su ficha', async () => {
    getClients.mockResolvedValue({ data: [{ id: 'cl9', name: 'Hotel Las Palmas', rif: 'J-9' }], total: 1 });
    renderWithQuery(<CommandPalette open onClose={vi.fn()} />);

    await userEvent.type(screen.getByRole('combobox'), 'h');
    expect(getClients).not.toHaveBeenCalled();

    await userEvent.type(screen.getByRole('combobox'), 'otel');
    const option = await screen.findByRole('option', { name: /Hotel Las Palmas/ });
    expect(getClients).toHaveBeenLastCalledWith({ page: 1, pageSize: 5, search: 'hotel' });

    await userEvent.click(option);
    expect(router.push).toHaveBeenCalledWith('/clients/cl9');
  });

  it('no busca clientes si el usuario no puede verlos', async () => {
    perms.value = permissionsFor('dashboard:ver');
    renderWithQuery(<CommandPalette open onClose={vi.fn()} />);
    await userEvent.type(screen.getByRole('combobox'), 'hotel');
    // Esperamos más que el debounce (200ms) antes de afirmar que no hubo búsqueda
    await act(() => new Promise((r) => setTimeout(r, 300)));
    expect(getClients).not.toHaveBeenCalled();
  });
});
