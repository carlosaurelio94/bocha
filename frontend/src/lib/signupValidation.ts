/**
 * Reglas del alta self-service. Las comparten el formulario (/register) y la
 * API (/api/auth/signup) para que el usuario vea el mismo error antes de enviar.
 */
export const SLUG_RE      = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/;
export const USERNAME_RE  = /^[a-z0-9_]{3,32}$/;
export const MIN_PASSWORD = 8;

export interface SignupInput {
  companyName: string;
  companySlug: string;
  username:    string;
  password:    string;
}

export type SignupErrors = Partial<Record<keyof SignupInput, string>>;

export function validateSignup(input: SignupInput): SignupErrors {
  const errors: SignupErrors = {};
  if (input.companyName.trim().length < 2) {
    errors.companyName = 'Escribí el nombre de tu empresa.';
  }
  if (!SLUG_RE.test(input.companySlug)) {
    errors.companySlug = 'Entre 3 y 32 caracteres: minúsculas, números o guiones (sin guion al inicio ni al final).';
  }
  if (!USERNAME_RE.test(input.username)) {
    errors.username = 'Entre 3 y 32 caracteres: minúsculas, números o guion bajo.';
  }
  if (input.password.length < MIN_PASSWORD) {
    errors.password = `Mínimo ${MIN_PASSWORD} caracteres.`;
  }
  return errors;
}

/** "Mi Vivero Ñandú S.A." → "mi-vivero-nandu-s-a" */
export function slugify(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32).replace(/-+$/g, '');
}

/** Normaliza lo que se tipea en "usuario": minúsculas, sin acentos, espacios → _. */
export function normalizeUsername(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 32);
}
