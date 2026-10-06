import {
  LayoutDashboard,
  Users,
  FileText,
  Settings,
  ShieldCheck,
  Building2,
  Receipt,
  CreditCard,
} from 'lucide-react';
import type { Module } from '@/types/permissions';

export interface NavItem {
  href:   string;
  label:  string;
  icon:   React.ElementType;
  module: Module;
  /** Palabras extra para el buscador rápido (Ctrl+K). */
  keywords?: string;
}

export interface NavGroup {
  label: string | null;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    label: null,
    items: [
      { href: '/dashboard', label: 'Inicio', icon: LayoutDashboard, module: 'dashboard', keywords: 'dashboard resumen métricas' },
    ],
  },
  {
    label: 'Ventas',
    items: [
      { href: '/clients', label: 'Clientes',     icon: Users,    module: 'clientes',     keywords: 'prospectos contactos' },
      { href: '/quotes',  label: 'Presupuestos', icon: FileText, module: 'presupuestos', keywords: 'cotizaciones ventas' },
    ],
  },
  {
    label: 'Compras',
    items: [
      { href: '/suppliers', label: 'Proveedores', icon: Building2, module: 'proveedores', keywords: 'compras' },
      { href: '/invoices',  label: 'Facturas',    icon: Receipt,   module: 'facturas',    keywords: 'pagos compras' },
    ],
  },
  {
    label: 'Ajustes',
    items: [
      { href: '/settings',         label: 'Configuración',      icon: Settings,    module: 'configuracion', keywords: 'textos presets' },
      { href: '/settings/billing', label: 'Plan y facturación', icon: CreditCard,  module: 'configuracion', keywords: 'suscripción plan' },
      { href: '/admin',            label: 'Usuarios y roles',   icon: ShieldCheck, module: 'admin',         keywords: 'permisos equipo' },
    ],
  },
];

/** Match exacto para rutas que tienen sub-rutas propias en el menú. */
export function isActive(pathname: string, href: string): boolean {
  if (href === '/settings' || href === '/admin') return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
