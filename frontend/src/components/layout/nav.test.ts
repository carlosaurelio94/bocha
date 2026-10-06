import { describe, it, expect } from 'vitest';
import { isActive, navGroups } from './nav';

describe('isActive', () => {
  it('marca la ruta exacta', () => {
    expect(isActive('/clients', '/clients')).toBe(true);
  });

  it('marca sub-rutas (detalle, alta)', () => {
    expect(isActive('/clients/123', '/clients')).toBe(true);
    expect(isActive('/quotes/new', '/quotes')).toBe(true);
  });

  it('no confunde rutas que solo comparten prefijo de texto', () => {
    expect(isActive('/quotes-archive', '/quotes')).toBe(false);
  });

  it('/settings no queda activo dentro de /settings/billing', () => {
    expect(isActive('/settings/billing', '/settings')).toBe(false);
    expect(isActive('/settings/billing', '/settings/billing')).toBe(true);
  });

  it('/admin no queda activo dentro de /admin/companies', () => {
    expect(isActive('/admin/companies', '/admin')).toBe(false);
  });
});

describe('navGroups', () => {
  const items = navGroups.flatMap((g) => g.items);

  it('no tiene rutas duplicadas', () => {
    const hrefs = items.map((i) => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it('cada ítem declara el módulo de permisos que lo protege', () => {
    items.forEach((i) => expect(i.module).toBeTruthy());
  });
});
