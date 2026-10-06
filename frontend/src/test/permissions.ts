import type { Action, Module } from '@/types/permissions';

/** Valor del contexto de permisos para tests: `grant('clientes:ver', ...)`. */
export function permissionsFor(...granted: `${Module}:${Action}`[]) {
  const set = new Set<string>(granted);
  return {
    permissions:   [],
    roles:         [],
    isAdmin:       false,
    loading:       false,
    hasPermission: (m: Module, a: Action) => set.has(`${m}:${a}`),
    canView:       (m: Module) => set.has(`${m}:ver`),
  };
}

export const ALL_PERMISSIONS = [
  'dashboard:ver',
  'clientes:ver', 'clientes:crear', 'clientes:editar', 'clientes:eliminar',
  'presupuestos:ver', 'presupuestos:crear', 'presupuestos:editar', 'presupuestos:eliminar',
  'proveedores:ver', 'facturas:ver', 'facturas:crear',
  'configuracion:ver', 'admin:ver',
] as const;
