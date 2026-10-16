import { describe, it, expect } from 'vitest';
import { parsePlanLimit, pgCode, friendlyError } from './errors';

describe('parsePlanLimit', () => {
  it.each([
    ['plan_limit:max_clients:25',            '25 clientes'],
    ['plan_limit:max_users:2',               '2 usuarios'],
    ['plan_limit:max_quotes_per_month:20',   '20 presupuestos por mes'],
    ['plan_limit:max_invoices_per_month:10', '10 facturas por mes'],
  ])('%s → menciona "%s"', (message, text) => {
    const limit = parsePlanLimit({ message, code: 'P0001' });
    expect(limit?.message).toContain(text);
    expect(limit?.message).toMatch(/Mejorá el plan/);
  });

  it('acepta el error como string', () => {
    expect(parsePlanLimit('plan_limit:max_clients:5')?.limit).toBe(5);
  });

  it('devuelve null para otros errores', () => {
    expect(parsePlanLimit({ message: 'duplicate key value' })).toBeNull();
    expect(parsePlanLimit(null)).toBeNull();
  });
});

describe('pgCode', () => {
  it('extrae el código de Postgres', () => {
    expect(pgCode({ code: '23505' })).toBe('23505');
    expect(pgCode(new Error('x'))).toBeUndefined();
  });
});

describe('friendlyError', () => {
  it('nunca muestra el texto crudo de Postgres', () => {
    expect(friendlyError({ message: 'new row violates row-level security policy' }, 'No se pudo guardar')).toBe('No se pudo guardar');
  });

  it('explica el límite del plan', () => {
    expect(friendlyError({ message: 'plan_limit:max_invoices_per_month:10' }, 'x')).toMatch(/10 facturas por mes/);
  });
});
