import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithQuery } from '@/test/render';
import { createSupabaseMock } from '@/test/supabaseMock';
import { permissionsFor } from '@/test/permissions';

const sb = vi.hoisted(() => ({ mock: null as unknown as ReturnType<typeof createSupabaseMock> }));
vi.mock('@/lib/supabase', async () => {
  const { createSupabaseMock } = await import('@/test/supabaseMock');
  sb.mock = createSupabaseMock();
  return { supabase: sb.mock.client };
});
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));
const perms = vi.hoisted(() => ({ value: null as unknown }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => perms.value }));

import AdminPage from './page';

const roles = [
  { id: 'r-admin',  name: 'administrador', description: 'Acceso total' },
  { id: 'r-viewer', name: 'viewer',        description: 'Lectura en todos los módulos' },
];
const profiles = [
  { id: 'me',  email: 'me@x', username: 'carlos', display_name: 'Carlos', user_roles: [{ role: roles[0] }] },
  { id: 'u2',  email: 'u2@x', username: 'maria',  display_name: 'María',  user_roles: [{ role: roles[1] }] },
  { id: 'otro', email: 'o@x', username: 'ajeno', display_name: 'De otra empresa', user_roles: [] },
];

const fetchMock = vi.fn();

function respondData() {
  sb.mock.respond('profiles', { data: profiles });
  sb.mock.respond('roles', { data: roles });
}

beforeEach(() => {
  sb.mock.reset();
  toast.success.mockClear(); toast.error.mockClear();
  perms.value = { ...permissionsFor('admin:ver'), isAdmin: true };
  sb.mock.client.auth.getUser.mockResolvedValue({ data: { user: { id: 'me' } }, error: null } as never);
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  respondData();
});
afterEach(() => vi.unstubAllGlobals());

const row = (name: string) => screen.getByText(name).closest('li') as HTMLElement;

describe('AdminPage', () => {
  it('lista solo miembros de la empresa con su rol legible', async () => {
    renderWithQuery(<AdminPage />);
    expect(await screen.findByText('María')).toBeInTheDocument();
    expect(screen.queryByText('De otra empresa')).toBeNull();
    expect(within(row('María')).getByRole('combobox')).toHaveDisplayValue('Solo lectura');
  });

  it('cambiar el rol hace upsert en user_roles (no borra la membresía)', async () => {
    renderWithQuery(<AdminPage />);
    await screen.findByText('María');
    respondData(); // recarga después de cambiar

    await userEvent.selectOptions(within(row('María')).getByRole('combobox'), 'r-admin');

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Ahora María es Administrador'));
    const ops = sb.mock.lastOps('user_roles');
    expect(ops[0]).toEqual(['insert', [{ user_id: 'u2', role_id: 'r-admin' }]]);
    expect(sb.mock.queries.some((q) => q.ops.some(([m]) => m === 'delete'))).toBe(false);
  });

  it('no deja cambiar el propio rol ni quitarse a uno mismo', async () => {
    renderWithQuery(<AdminPage />);
    await screen.findByText('María');
    const me = row('Carlos');
    expect(within(me).getByText('(vos)')).toBeInTheDocument();
    expect(within(me).getByRole('combobox')).toBeDisabled();
    expect(within(me).queryByRole('button', { name: /Quitar/ })).toBeNull();
  });

  it('quitar pide confirmación en un modal propio (no confirm del navegador)', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    renderWithQuery(<AdminPage />);
    await screen.findByText('María');
    respondData();

    await userEvent.click(screen.getByRole('button', { name: 'Quitar a María' }));
    const dialog = screen.getByRole('dialog', { name: 'Quitar usuario' });
    expect(fetchMock).not.toHaveBeenCalled();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Sí, quitar' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/admin/users?userId=u2', { method: 'DELETE' }));
    expect(toast.success).toHaveBeenCalledWith('Usuario quitado de la empresa');
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('crear usuario valida antes de llamar a la API y muestra el error del servidor', async () => {
    renderWithQuery(<AdminPage />);
    await screen.findByText('María');
    await userEvent.click(screen.getByRole('button', { name: /Nuevo usuario/ }));
    const dialog = screen.getByRole('dialog', { name: 'Nuevo usuario' });

    await userEvent.type(within(dialog).getByLabelText(/^Usuario/), 'José Luis');
    expect(within(dialog).getByLabelText(/^Usuario/)).toHaveValue('jose_luis');
    await userEvent.type(within(dialog).getByLabelText(/^Contraseña/), '123');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Crear usuario' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent(/al menos 8/);
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: 'Llegaste al límite de tu plan (2 usuarios). Mejorá el plan para seguir.' }), { status: 409 }));
    await userEvent.clear(within(dialog).getByLabelText(/^Contraseña/));
    await userEvent.type(within(dialog).getByLabelText(/^Contraseña/), '12345678');
    await userEvent.selectOptions(within(dialog).getByLabelText(/^Rol/), 'r-viewer');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Crear usuario' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/límite de tu plan \(2 usuarios\)/);
  });

  it('un no-admin ve un aviso', async () => {
    perms.value = { ...permissionsFor('dashboard:ver'), isAdmin: false };
    renderWithQuery(<AdminPage />);
    expect(screen.getByText('Sección solo para administradores')).toBeInTheDocument();
  });
});
