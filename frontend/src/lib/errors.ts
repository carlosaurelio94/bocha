/**
 * Traducción de errores de Supabase/Postgres a mensajes para el usuario.
 */

const PLAN_LIMIT_RE = /plan_limit:(\w+):(\d+)/;

const RESOURCE: Record<string, (n: number) => string> = {
  max_clients:            (n) => `${n} clientes`,
  max_users:              (n) => `${n} usuarios`,
  max_quotes_per_month:   (n) => `${n} presupuestos por mes`,
  max_invoices_per_month: (n) => `${n} facturas por mes`,
};

export interface PlanLimit {
  field: string;
  limit: number;
  message: string;
}

/** Si el error es un límite del plan (trigger enforce_plan_limit), lo describe. */
export function parsePlanLimit(error: unknown): PlanLimit | null {
  const text = errorText(error);
  const m = PLAN_LIMIT_RE.exec(text);
  if (!m) return null;
  const limit = Number(m[2]);
  const what  = RESOURCE[m[1]]?.(limit) ?? 'lo que permite';
  return {
    field:   m[1],
    limit,
    message: `Llegaste al límite de tu plan (${what}). Mejorá el plan para seguir.`,
  };
}

/** Código de Postgres (p. ej. '23505' unique_violation) si viene en el error. */
export function pgCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : undefined;
}

function errorText(error: unknown): string {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && 'message' in error) return String((error as { message: unknown }).message);
  return String(error);
}

/**
 * Mensaje para mostrar en un formulario: el del límite del plan si aplica, o el
 * genérico. Nunca el texto crudo de Postgres (en inglés y con detalles internos).
 */
export function friendlyError(error: unknown, fallback: string): string {
  return parsePlanLimit(error)?.message ?? fallback;
}
