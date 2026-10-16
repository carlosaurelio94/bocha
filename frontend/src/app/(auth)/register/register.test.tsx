import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const auth = vi.hoisted(() => ({ signInWithPassword: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { auth } }));

import RegisterPage from './page';

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  auth.signInWithPassword.mockReset().mockResolvedValue({ error: { message: 'x' } });
});
afterEach(() => vi.unstubAllGlobals());

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

async function fillValid() {
  await userEvent.type(screen.getByLabelText(/Nombre de la empresa/), 'Vivero Ñandú');
  await userEvent.type(screen.getByLabelText(/Usuario para entrar/), 'Carlos R');
  await userEvent.type(screen.getByLabelText(/^Contraseña/), '12345678');
}

describe('RegisterPage', () => {
  it('genera la dirección de acceso desde el nombre y normaliza el usuario', async () => {
    render(<RegisterPage />);
    await fillValid();
    expect(screen.getByLabelText(/Dirección de acceso/)).toHaveValue('vivero-nandu');
    expect(screen.getByLabelText(/Usuario para entrar/)).toHaveValue('carlos_r');
    expect(screen.getByText(/login\?company=vivero-nandu/)).toBeInTheDocument();
  });

  it('si editás la dirección a mano, cambiar el nombre ya no la pisa', async () => {
    render(<RegisterPage />);
    await userEvent.type(screen.getByLabelText(/Nombre de la empresa/), 'Vivero');
    const slug = screen.getByLabelText(/Dirección de acceso/);
    await userEvent.clear(slug);
    await userEvent.type(slug, 'mi-vivero');
    await userEvent.type(screen.getByLabelText(/Nombre de la empresa/), ' Urbano');
    expect(slug).toHaveValue('mi-vivero');
  });

  it('valida antes de enviar y no llama a la API con datos inválidos', async () => {
    render(<RegisterPage />);
    await userEvent.type(screen.getByLabelText(/^Contraseña/), '123');
    await userEvent.click(screen.getByRole('button', { name: 'Crear mi backoffice' }));

    expect(screen.getByText('Escribí el nombre de tu empresa.')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Contraseña/)).toHaveAttribute('aria-invalid', 'true');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('muestra en el campo el error que devuelve el servidor (usuario ocupado)', async () => {
    fetchMock.mockResolvedValue(json(409, { error: 'Ese usuario ya está en uso', fields: { username: 'Ya está en uso, elegí otro.' } }));
    render(<RegisterPage />);
    await fillValid();
    await userEvent.click(screen.getByRole('button', { name: 'Crear mi backoffice' }));

    expect(await screen.findByText('Ya está en uso, elegí otro.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear mi backoffice' })).toBeEnabled();
  });

  it('no queda "cargando" para siempre si el servidor responde algo que no es JSON', async () => {
    fetchMock.mockResolvedValue(new Response('<html>502 Bad Gateway</html>', { status: 502 }));
    render(<RegisterPage />);
    await fillValid();
    await userEvent.click(screen.getByRole('button', { name: 'Crear mi backoffice' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo completar el registro.');
    expect(screen.getByRole('button', { name: 'Crear mi backoffice' })).toBeEnabled();
  });

  it('no manda plan en el body', async () => {
    fetchMock.mockResolvedValue(json(200, { ok: true, email: 'carlos_r@vivero-nandu.internal' }));
    render(<RegisterPage />);
    await fillValid();
    await userEvent.click(screen.getByRole('button', { name: 'Crear mi backoffice' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toHaveProperty('planSlug');
  });

  it('si el auto-login falla, muestra el éxito y cómo entrar', async () => {
    fetchMock.mockResolvedValue(json(200, { ok: true, email: 'carlos_r@vivero-nandu.internal' }));
    render(<RegisterPage />);
    await fillValid();
    await userEvent.click(screen.getByRole('button', { name: 'Crear mi backoffice' }));

    expect(await screen.findByText('¡Empresa creada!')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ir a iniciar sesión/ })).toHaveAttribute('href', '/login?company=vivero-nandu');
  });
});
