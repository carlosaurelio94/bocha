import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithQuery } from '@/test/render';
import { createSupabaseMock } from '@/test/supabaseMock';
import type { Client } from '@/types';

const sb = vi.hoisted(() => ({ mock: null as unknown as ReturnType<typeof createSupabaseMock> }));
vi.mock('@/lib/supabase', async () => {
  const { createSupabaseMock } = await import('@/test/supabaseMock');
  sb.mock = createSupabaseMock();
  return { supabase: sb.mock.client };
});
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

import { ClientForm } from './ClientForm';

const existing: Client = {
  id: 'c1', name: 'Ana Torres', rif: 'J-1', phone: '0412', address: 'Caracas',
  client_status: 'client', created_by: 'x', created_at: '2026-01-01', deleted: false,
};

beforeEach(() => {
  sb.mock.reset();
  toast.success.mockClear();
  toast.error.mockClear();
});

describe('ClientForm', () => {
  it('no deja guardar sin un nombre válido', async () => {
    renderWithQuery(<ClientForm open onClose={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/Nombre/), 'A');
    await userEvent.click(screen.getByRole('button', { name: 'Crear cliente' }));

    expect(await screen.findByText('Mínimo 2 caracteres')).toBeInTheDocument();
    expect(sb.mock.queries).toHaveLength(0);
  });

  it('crea el cliente, avisa, devuelve el guardado y cierra', async () => {
    const onClose = vi.fn();
    const onSaved = vi.fn();
    sb.mock.respond('clients', { data: { ...existing, id: 'nuevo', name: 'Pedro' } });

    renderWithQuery(<ClientForm open onClose={onClose} onSaved={onSaved} />);
    await userEvent.type(screen.getByLabelText(/Nombre/), 'Pedro');
    await userEvent.selectOptions(screen.getByLabelText(/Estado/), 'client');
    await userEvent.click(screen.getByRole('button', { name: 'Crear cliente' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: 'nuevo' }));
    expect(toast.success).toHaveBeenCalledWith('Cliente creado');

    const [payload] = sb.mock.lastOps('clients')[0][1] as [Record<string, unknown>];
    expect(payload).toMatchObject({ name: 'Pedro', client_status: 'client' });
    // Campos opcionales vacíos no se mandan como string vacío
    expect(payload.rif).toBeUndefined();
    expect(payload.phone).toBeUndefined();
  });

  it('en modo edición precarga los datos y actualiza', async () => {
    sb.mock.respond('clients', { data: existing });
    const onClose = vi.fn();

    renderWithQuery(<ClientForm open onClose={onClose} client={existing} />);
    expect(screen.getByRole('dialog', { name: 'Editar cliente' })).toBeInTheDocument();
    const name = screen.getByLabelText(/Nombre/);
    expect(name).toHaveValue('Ana Torres');

    await userEvent.clear(name);
    await userEvent.type(name, 'Ana T.');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const ops = sb.mock.lastOps('clients');
    expect(ops[0][0]).toBe('update');
    expect(ops).toContainEqual(['eq', ['id', 'c1']]);
  });

  it('si falla el guardado muestra error y no cierra', async () => {
    sb.mock.respond('clients', { error: new Error('rls') });
    const onClose = vi.fn();

    renderWithQuery(<ClientForm open onClose={onClose} />);
    await userEvent.type(screen.getByLabelText(/Nombre/), 'Pedro');
    await userEvent.click(screen.getByRole('button', { name: 'Crear cliente' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('No se pudo crear el cliente'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Cancelar cierra sin guardar', async () => {
    const onClose = vi.fn();
    renderWithQuery(<ClientForm open onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalled();
    expect(sb.mock.queries).toHaveLength(0);
  });
});
