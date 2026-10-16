/** Nombres legibles para los roles del sistema (los de la base son técnicos). */
export const ROLE_LABELS: Record<string, string> = {
  administrador:        'Administrador',
  usuario_clientes:     'Clientes',
  usuario_presupuestos: 'Presupuestos',
  usuario_facturas:     'Compras y facturas',
  viewer:               'Solo lectura',
};

export const roleLabel = (name: string) => ROLE_LABELS[name] ?? name;
