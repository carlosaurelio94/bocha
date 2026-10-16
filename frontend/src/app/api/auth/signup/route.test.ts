// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const sb = vi.hoisted(() => {
  const rpc = vi.fn();
  return {
    rpc,
    createUser:  vi.fn(),
    deleteUser:  vi.fn(),
    signIn:      vi.fn(),
    signOut:     vi.fn(),
  };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    rpc: sb.rpc,
    auth: {
      admin: { createUser: sb.createUser, deleteUser: sb.deleteUser },
      signInWithPassword: sb.signIn,
      signOut: sb.signOut,
    },
  }),
}));

import { POST } from './route';

const valid = { companyName: 'Vivero Urbano', companySlug: 'vivero-urbano', username: 'carlos', password: '12345678' };
const post = (body: unknown) =>
  POST(new Request('http://localhost/api/auth/signup', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }));

beforeEach(() => {
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key');
  Object.values(sb).forEach((f) => f.mockReset());
  sb.rpc.mockImplementation(async (fn: string) => {
    if (fn === 'is_company_slug_available' || fn === 'is_username_available') return { data: true };
    if (fn === 'bootstrap_company') return { data: 'company-1', error: null };
    return { data: null };
  });
  sb.createUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
  sb.signIn.mockResolvedValue({ data: { session: { access_token: 'tok' } }, error: null });
  sb.signOut.mockResolvedValue({ error: null });
});

describe('POST /api/auth/signup', () => {
  it('crea la empresa y devuelve el email interno', async () => {
    const res = await post(valid);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, companyId: 'company-1', email: 'carlos@vivero-urbano.internal' });
  });

  it('SEGURIDAD: siempre crea la empresa en plan free aunque pidan otro', async () => {
    await post({ ...valid, planSlug: 'enterprise' });
    const bootstrap = sb.rpc.mock.calls.find(([fn]) => fn === 'bootstrap_company');
    expect(bootstrap?.[1]).toMatchObject({ p_plan_slug: 'free' });
  });

  it('JSON inválido → 400', async () => {
    expect((await post('{ nope')).status).toBe(400);
    expect((await post('null')).status).toBe(400);
  });

  it('campos con tipo incorrecto → 400 (no 500)', async () => {
    const res = await post({ ...valid, companySlug: 123 });
    expect(res.status).toBe(400);
    expect(sb.createUser).not.toHaveBeenCalled();
  });

  it('valida con las mismas reglas que el formulario y devuelve errores por campo', async () => {
    const res = await post({ ...valid, password: 'corta', username: 'A' });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.fields).toHaveProperty('password');
    expect(body.fields).toHaveProperty('username');
    expect(sb.createUser).not.toHaveBeenCalled();
  });

  it('dirección o usuario ocupados → 409 con el campo marcado', async () => {
    sb.rpc.mockImplementation(async (fn: string) => ({ data: fn !== 'is_username_available' }));
    const res = await post(valid);
    expect(res.status).toBe(409);
    expect((await res.json()).fields).toHaveProperty('username');
  });

  it('si falla el alta de la empresa borra el usuario creado (no deja cuentas huérfanas)', async () => {
    sb.rpc.mockImplementation(async (fn: string) =>
      fn === 'bootstrap_company' ? { data: null, error: { message: 'boom' } } : { data: true });
    const res = await post(valid);
    expect(res.status).toBe(500);
    expect(sb.deleteUser).toHaveBeenCalledWith('user-1');
  });
});
