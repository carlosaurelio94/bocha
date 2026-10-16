import { describe, it, expect, vi, afterEach } from 'vitest';
import { requestJson } from './http';

afterEach(() => vi.unstubAllGlobals());

const respond = (status: number, body: string) =>
  vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status, headers: { 'Content-Type': 'application/json' } })));

describe('requestJson', () => {
  it('devuelve los datos cuando la API responde ok', async () => {
    respond(200, JSON.stringify({ ok: true, email: 'a@b.c' }));
    expect(await requestJson('/api/x')).toEqual({ ok: true, data: { ok: true, email: 'a@b.c' } });
  });

  it('devuelve el error de la API y el body (p. ej. errores por campo)', async () => {
    respond(409, JSON.stringify({ error: 'Ese usuario ya está en uso', fields: { username: 'Ya está en uso' } }));
    const res = await requestJson('/api/x');
    expect(res).toMatchObject({ ok: false, error: 'Ese usuario ya está en uso', status: 409 });
    if (!res.ok) expect(res.body?.fields).toEqual({ username: 'Ya está en uso' });
  });

  it('no revienta si la respuesta no es JSON (página de error 500)', async () => {
    respond(500, '<html>Internal Server Error</html>');
    expect(await requestJson('/api/x', undefined, 'Falló')).toMatchObject({ ok: false, error: 'Falló' });
  });

  it('trata { ok: false } con 200 como error', async () => {
    respond(200, JSON.stringify({ ok: false, error: 'nope' }));
    expect(await requestJson('/api/x')).toMatchObject({ ok: false, error: 'nope' });
  });

  it('informa falta de conexión', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    const res = await requestJson('/api/x');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/conexión/);
  });
});
