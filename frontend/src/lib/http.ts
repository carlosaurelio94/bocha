/**
 * fetch a una API propia que devuelve `{ ok, error }`, sin reventar si la
 * respuesta no es JSON (p. ej. una página de error 500) o si se corta la red.
 * Antes, `await res.json()` tiraba y el formulario quedaba "cargando" para siempre.
 */
export async function requestJson<T extends object = Record<string, unknown>>(
  url: string,
  init?: RequestInit,
  fallbackError = 'Ocurrió un error. Probá de nuevo.',
): Promise<{ ok: true; data: T } | { ok: false; error: string; status?: number; body?: Record<string, unknown> | null }> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    return { ok: false, error: 'No hay conexión. Revisá tu internet y probá de nuevo.' };
  }

  let body: (T & { ok?: boolean; error?: string }) | null = null;
  try {
    body = await res.json();
  } catch {
    // respuesta sin JSON
  }

  if (!res.ok || !body || body.ok === false) {
    return { ok: false, error: body?.error ?? fallbackError, status: res.status, body: body as Record<string, unknown> | null };
  }
  return { ok: true, data: body };
}
