import { describe, it, expect } from 'vitest';
import { validateSignup, slugify, normalizeUsername } from './signupValidation';

const valid = { companyName: 'Jardines del Sur', companySlug: 'jardines-del-sur', username: 'carlos_r', password: '12345678' };

describe('validateSignup', () => {
  it('acepta datos válidos', () => {
    expect(validateSignup(valid)).toEqual({});
  });

  it.each([
    ['companyName', { companyName: ' a ' }],
    ['companySlug', { companySlug: 'ab' }],
    ['companySlug', { companySlug: '-acme' }],
    ['companySlug', { companySlug: 'acme-' }],
    ['companySlug', { companySlug: 'Acme' }],
    ['companySlug', { companySlug: 'a'.repeat(33) }],
    ['username', { username: 'ca' }],
    ['username', { username: 'carlos.r' }],
    ['username', { username: 'Carlos' }],
    ['password', { password: '1234567' }],
  ])('marca error en %s', (field, patch) => {
    expect(validateSignup({ ...valid, ...patch })).toHaveProperty(field);
  });

  it('acumula todos los errores', () => {
    expect(Object.keys(validateSignup({ companyName: '', companySlug: '', username: '', password: '' })))
      .toEqual(['companyName', 'companySlug', 'username', 'password']);
  });
});

describe('slugify', () => {
  it.each([
    ['Jardines del Sur', 'jardines-del-sur'],
    ['Jardinería Ñandú S.A.', 'jardineria-nandu-s-a'],
    ['  --Hola  Mundo--  ', 'hola-mundo'],
  ])('"%s" → "%s"', (input, out) => {
    expect(slugify(input)).toBe(out);
  });

  it('respeta el máximo y no termina en guion', () => {
    const s = slugify('a'.repeat(31) + ' bbbb');
    expect(s.length).toBeLessThanOrEqual(32);
    expect(s.endsWith('-')).toBe(false);
  });

  it('lo que genera siempre pasa la validación (si tiene largo suficiente)', () => {
    ['Jardines del Sur', 'Ñandú & Cía.', 'ACME 2026'].forEach((name) => {
      expect(validateSignup({ ...valid, companySlug: slugify(name) }).companySlug).toBeUndefined();
    });
  });
});

describe('normalizeUsername', () => {
  it('pasa a minúsculas, quita acentos y caracteres inválidos', () => {
    expect(normalizeUsername('José Pérez')).toBe('jose_perez');
    expect(normalizeUsername('ana.torres@mail')).toBe('anatorresmail');
  });
});
