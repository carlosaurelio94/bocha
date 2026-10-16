// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const sb = vi.hoisted(() => ({
  user:       { id: 'admin-1' } as { id: string } | null,
  role:       'administrador',
  createUser: vi.fn(),
  deleteUser: vi.fn(),
  updateUser: vi.fn(),
  deletes:    [] as string[],
}));

vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [] }) }));

/** Cliente "de sesión": responde perfil y membresía del admin logueado. */
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: sb.user } }) },
    from: (table: string) => {
      const chain = {
        select: () => chain, eq: () => chain,
        single: async () => table === 'profiles'
          ? { data: { current_company_id: 'company-1' } }
          : { data: { role: { name: sb.role }, company: { slug: 'vivero' } } },
      };
      return chain;
    },
  }),
}));

/** Cliente service-role. */
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { admin: { createUser: sb.createUser, deleteUser: sb.deleteUser, updateUserById: sb.updateUser } },
    from: (table: string) => {
      const chain: Record<string, unknown> = {
        select: () => chain, eq: () => chain, upsert: async () => ({ error: null }), insert: async () => ({ error: null }),
        delete: () => { sb.deletes.push(table); return chain; },
        maybeSingle: async () => ({ data: { user_id: 'x' } }),
        then: (r: (v: unknown) => unknown) => Promise.resolve({ error: null, count: 1 }).then(r),
      };
      return chain;
    },
  }),
}));

import { POST, PATCH, DELETE } from './route';

const req = (method: string, body?: unknown, query = '') =>
  new Request(`http://localhost/api/admin/users${query}`, {
    method, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });

beforeEach(() => {
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key');
  sb.user = { id: 'admin-1' };
  sb.role = 'administrador';
  sb.deletes = [];
  sb.createUser.mockReset().mockResolvedValue({ data: { user: { id: 'new-1' } }, error: null });
  sb.deleteUser.mockReset().mockResolvedValue({ error: null });
  sb.updateUser.mockReset().mockResolvedValue({ error: null });
});

describe('/api/admin/users — autorización', () => {
  it('sin sesión → 401', async () => {
    sb.user = null;
    expect((await POST(req('POST', {}))).status).toBe(401);
  });

  it('usuario que no es administrador → 403', async () => {
    sb.role = 'viewer';
    expect((await DELETE(req('DELETE', undefined, '?userId=u2'))).status).toBe(403);
  });
});

describe('POST — crear usuario', () => {
  const valid = { username: 'Maria Lopez', password: '12345678', roleId: 'r1' };

  it('crea con el usuario normalizado y email interno de la empresa', async () => {
    const res = await POST(req('POST', valid));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, username: 'maria_lopez' });
    expect(sb.createUser).toHaveBeenCalledWith(expect.objectContaining({ email: 'maria_lopez@vivero.internal' }));
  });

  it('rechaza contraseñas de menos de 8 caracteres', async () => {
    const res = await POST(req('POST', { ...valid, password: '123456' }));
    expect(res.status).toBe(400);
    expect(sb.createUser).not.toHaveBeenCalled();
  });

  it('rechaza usuarios con caracteres que después no permiten loguearse', async () => {
    expect((await POST(req('POST', { ...valid, username: 'maría!' }))).status).toBe(400);
    expect((await POST(req('POST', { ...valid, username: 'ab' }))).status).toBe(400);
  });

  it('JSON inválido → 400', async () => {
    expect((await POST(req('POST', '{ x'))).status).toBe(400);
  });
});

describe('PATCH — resetear contraseña', () => {
  it('exige mínimo 8 caracteres', async () => {
    expect((await PATCH(req('PATCH', { userId: 'u2', newPassword: '1234567' }))).status).toBe(400);
    expect(sb.updateUser).not.toHaveBeenCalled();
  });

  it('cambia la contraseña de un usuario de la empresa', async () => {
    expect((await PATCH(req('PATCH', { userId: 'u2', newPassword: '12345678' }))).status).toBe(200);
    expect(sb.updateUser).toHaveBeenCalledWith('u2', { password: '12345678' });
  });
});

describe('DELETE — quitar usuario', () => {
  it('un admin no puede quitarse a sí mismo (dejaría la empresa sin admin)', async () => {
    const res = await DELETE(req('DELETE', undefined, '?userId=admin-1'));
    expect(res.status).toBe(400);
    expect(sb.deletes).toHaveLength(0);
  });

  it('quita a otro usuario de la empresa', async () => {
    const res = await DELETE(req('DELETE', undefined, '?userId=u2'));
    expect(res.status).toBe(200);
    expect(sb.deletes).toContain('user_companies');
  });

  it('sin userId → 400', async () => {
    expect((await DELETE(req('DELETE'))).status).toBe(400);
  });
});
