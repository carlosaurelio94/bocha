import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const auth = vi.hoisted(() => ({
  getUser:            vi.fn(),
  signInWithPassword: vi.fn(),
  updateUser:         vi.fn(),
}));
vi.mock('@/lib/supabase', () => ({ supabase: { auth } }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

import { ChangePasswordForm } from './ChangePasswordForm';

beforeEach(() => {
  Object.values(auth).forEach((f) => f.mockReset());
  toast.success.mockReset(); toast.error.mockReset();
  auth.getUser.mockResolvedValue({ data: { user: { email: 'carlos@acme.internal' } } });
  auth.signInWithPassword.mockResolvedValue({ error: null });
  auth.updateUser.mockResolvedValue({ error: null });
});

async function fill(current: string, next: string, confirm = next) {
  await userEvent.type(screen.getByLabelText(/Contraseña actual/), current);
  await userEvent.type(screen.getByLabelText(/^Nueva contraseña/), next);
  await userEvent.type(screen.getByLabelText(/Repetir nueva contraseña/), confirm);
  await userEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
}

describe('ChangePasswordForm', () => {
  it('SEGURIDAD: verifica la contraseña actual antes de cambiarla', async () => {
    render(<ChangePasswordForm />);
    await fill('vieja-123', 'nueva-12345');

    await waitFor(() => expect(auth.updateUser).toHaveBeenCalledWith({ password: 'nueva-12345' }));
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'carlos@acme.internal', password: 'vieja-123' });
    expect(auth.signInWithPassword.mock.invocationCallOrder[0]).toBeLessThan(auth.updateUser.mock.invocationCallOrder[0]);
    expect(toast.success).toHaveBeenCalled();
    expect(screen.getByLabelText(/Contraseña actual/)).toHaveValue('');
  });

  it('si la contraseña actual es incorrecta NO cambia nada', async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } });
    render(<ChangePasswordForm />);
    await fill('equivocada', 'nueva-12345');

    expect(await screen.findByText('La contraseña actual no es correcta.')).toBeInTheDocument();
    expect(auth.updateUser).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/Contraseña actual/)).toHaveAttribute('aria-invalid', 'true');
  });

  it.each([
    ['menos de 8 caracteres', 'vieja-123', 'corta',       'corta',       /al menos 8/],
    ['igual a la actual',     'misma-123', 'misma-123',   'misma-123',   /distinta de la actual/],
    ['no coinciden',          'vieja-123', 'nueva-12345', 'otra-123456', /no coinciden/],
  ])('valida en el cliente: %s', async (_, current, next, confirm, message) => {
    render(<ChangePasswordForm />);
    await fill(current, next, confirm);
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('el botón queda deshabilitado hasta completar los tres campos', async () => {
    render(<ChangePasswordForm />);
    expect(screen.getByRole('button', { name: 'Cambiar contraseña' })).toBeDisabled();
  });

  it('se puede mostrar la contraseña', async () => {
    render(<ChangePasswordForm />);
    const input = screen.getByLabelText(/Contraseña actual/);
    expect(input).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getAllByRole('button', { name: 'Mostrar contraseña' })[0]);
    expect(input).toHaveAttribute('type', 'text');
  });
});
