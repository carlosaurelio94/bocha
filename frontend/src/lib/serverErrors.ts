/**
 * Errores de red entre las API routes y Supabase.
 * Node responde "fetch failed" cuando no llega al servidor (p. ej. el proyecto
 * de Supabase está pausado); mostrar eso tal cual no le dice nada al usuario.
 */
export const SERVICE_UNAVAILABLE =
  'El servicio no está disponible en este momento. Probá de nuevo en unos minutos.';

const NETWORK_ERROR = /fetch failed|failed to fetch|network|ECONNREFUSED|ECONNRESET|ENOTFOUND|ETIMEDOUT|EAI_AGAIN/i;

export function isUnreachable(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const { name, message } = err as { name?: unknown; message?: unknown };
  if (name === 'AuthRetryableFetchError') return true;
  return typeof message === 'string' && NETWORK_ERROR.test(message);
}
