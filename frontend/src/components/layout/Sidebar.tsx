'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/useTheme';
import { usePermissions } from '@/hooks/usePermissions';
import { useCompany } from '@/context/CompanyContext';
import { supabase } from '@/lib/supabase';
import { navGroups, isActive } from './nav';
import {
  Leaf,
  Sun,
  Moon,
  LogOut,
  ChevronsUpDown,
  Check,
  Globe,
  Search,
  X,
} from 'lucide-react';

interface SidebarProps {
  /** Se llama al navegar (en mobile cierra el drawer). */
  onNavigate?:    () => void;
  onOpenSearch?:  () => void;
  /** Muestra la X de cierre (solo en el drawer mobile). */
  onClose?:       () => void;
}

export function Sidebar({ onNavigate, onOpenSearch, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router   = useRouter();
  const { isDark, toggle } = useTheme();
  const { canView, loading } = usePermissions();
  const { current: company, available, switchTo, isSuperAdmin } = useCompany();
  const [companyMenuOpen, setCompanyMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Cerrar el selector de empresa al hacer click afuera
  useEffect(() => {
    if (!companyMenuOpen) return;
    const handle = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setCompanyMenuOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [companyMenuOpen]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  const handleSwitch = async (companyId: string) => {
    setCompanyMenuOpen(false);
    if (companyId === company?.id) return;
    await switchTo(companyId);
    router.refresh();
  };

  const brandColor  = company?.primary_color ?? '#16a34a';
  const brandName   = company?.name ?? 'Backoffice';
  const canSwitch   = available.length > 1;

  const groups = loading
    ? []
    : navGroups
        .map((g) => ({ ...g, items: g.items.filter((item) => canView(item.module)) }))
        .filter((g) => g.items.length > 0);

  const linkCls = (active: boolean) => cn(
    'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    active
      ? 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400'
      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
  );

  return (
    <aside className="flex h-full w-72 flex-col border-r border-gray-200 bg-white lg:w-64 dark:border-slate-800 dark:bg-slate-900">

      {/* Empresa */}
      <div ref={menuRef} className="relative flex items-center gap-2 p-3">
        <button
          onClick={() => canSwitch && setCompanyMenuOpen((o) => !o)}
          className={cn(
            'flex min-w-0 flex-1 items-center gap-3 rounded-lg p-2 text-left',
            canSwitch && 'hover:bg-gray-100 dark:hover:bg-slate-800'
          )}
          aria-haspopup={canSwitch ? 'listbox' : undefined}
          aria-expanded={canSwitch ? companyMenuOpen : undefined}
        >
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg shadow-sm"
            style={{ backgroundColor: brandColor }}
          >
            {company?.logo_url
              ? <img src={company.logo_url} alt="" className="h-5 w-5 object-contain" />
              : <Leaf className="h-5 w-5 text-white" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-gray-900 dark:text-slate-100">{brandName}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              {canSwitch ? 'Cambiar empresa' : 'Backoffice'}
            </p>
          </div>
          {canSwitch && <ChevronsUpDown className="h-4 w-4 shrink-0 text-gray-400" />}
        </button>

        {onClose && (
          <button
            onClick={onClose}
            aria-label="Cerrar menú"
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        {companyMenuOpen && canSwitch && (
          <div className="animate-fade-in absolute left-3 right-3 top-full z-20 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
            {available.map((c) => (
              <button
                key={c.id}
                onClick={() => handleSwitch(c.id)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-slate-800"
              >
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: c.primary_color ?? '#16a34a' }} />
                <span className="flex-1 truncate text-gray-700 dark:text-slate-200">{c.name}</span>
                {c.id === company?.id && <Check className="h-4 w-4 text-green-600" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Buscador rápido */}
      {onOpenSearch && (
        <div className="px-3 pb-2">
          <button
            onClick={onOpenSearch}
            className="flex w-full items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500
                       transition-colors hover:border-gray-300 hover:bg-white
                       dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400 dark:hover:border-slate-600"
          >
            <Search className="h-4 w-4" />
            <span className="flex-1 text-left">Buscar o crear…</span>
            <kbd className="hidden rounded border border-gray-200 bg-white px-1.5 font-sans text-[10px] font-medium text-gray-400 sm:inline dark:border-slate-600 dark:bg-slate-900">
              Ctrl K
            </kbd>
          </button>
        </div>
      )}

      {/* Navegación */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {loading && (
          <div className="flex flex-col gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-9 animate-pulse rounded-lg bg-gray-100 dark:bg-slate-800" />
            ))}
          </div>
        )}

        {groups.map((group, gi) => (
          <div key={group.label ?? gi} className={gi > 0 ? 'mt-5' : ''}>
            {group.label && (
              <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map(({ href, label, icon: Icon }) => {
                const active = isActive(pathname, href);
                return (
                  <Link key={href} href={href} onClick={onNavigate} className={linkCls(active)} aria-current={active ? 'page' : undefined}>
                    <Icon className={cn(
                      'h-[18px] w-[18px]',
                      active ? 'text-green-600 dark:text-green-400' : 'text-gray-400 group-hover:text-gray-600 dark:text-slate-500 dark:group-hover:text-slate-300'
                    )} />
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {isSuperAdmin && !loading && (
          <div className="mt-5">
            <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500">
              Super-admin
            </p>
            <Link
              href="/admin/companies"
              onClick={onNavigate}
              className={cn(
                linkCls(false),
                pathname.startsWith('/admin/companies') && 'bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400'
              )}
            >
              <Globe className="h-[18px] w-[18px] text-purple-500" />
              Empresas (todas)
            </Link>
          </div>
        )}
      </nav>

      {/* Pie */}
      <div className="border-t border-gray-200 p-3 dark:border-slate-800">
        <div className="flex gap-1">
          <button
            onClick={toggle}
            className="flex flex-1 items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-600 transition-colors
                       hover:bg-gray-100 hover:text-gray-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          >
            {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
            <span>{isDark ? 'Modo claro' : 'Modo oscuro'}</span>
          </button>
          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
            className="rounded-lg px-3 py-2 text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600
                       dark:text-slate-500 dark:hover:bg-red-900/20 dark:hover:text-red-400"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
