'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, Search, Leaf } from 'lucide-react';
import { useCompany } from '@/context/CompanyContext';
import { Sidebar } from './Sidebar';
import { CommandPalette } from './CommandPalette';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { current: company } = useCompany();
  const [drawerOpen, setDrawerOpen]   = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const openPalette  = useCallback(() => { setDrawerOpen(false); setPaletteOpen(true); }, []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);

  // Ctrl/Cmd + K abre el buscador desde cualquier pantalla
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Cerrar el drawer al cambiar de ruta (p. ej. botón "atrás" del navegador)
  useEffect(() => { setDrawerOpen(false); }, [pathname]); // eslint-disable-line react-hooks/set-state-in-effect

  return (
    <div className="flex h-dvh overflow-hidden bg-slate-50 dark:bg-slate-950">

      {/* Sidebar fija en desktop */}
      <div className="hidden lg:flex">
        <Sidebar onOpenSearch={openPalette} />
      </div>

      {/* Drawer en mobile/tablet */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="animate-fade-in absolute inset-0 bg-gray-950/50" onClick={() => setDrawerOpen(false)} />
          <div className="animate-slide-in-left relative h-full w-fit shadow-2xl">
            <Sidebar
              onNavigate={() => setDrawerOpen(false)}
              onOpenSearch={openPalette}
              onClose={() => setDrawerOpen(false)}
            />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra superior mobile */}
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-gray-200 bg-white/90 px-3 backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-900/90">
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Abrir menú"
            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
              style={{ backgroundColor: company?.primary_color ?? '#16a34a' }}
            >
              {company?.logo_url
                ? <img src={company.logo_url} alt="" className="h-4 w-4 object-contain" />
                : <Leaf className="h-4 w-4 text-white" />}
            </span>
            <span className="truncate text-sm font-semibold text-gray-900 dark:text-slate-100">
              {company?.name ?? 'Backoffice'}
            </span>
          </div>
          <button
            onClick={openPalette}
            aria-label="Buscar"
            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Search className="h-5 w-5" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={closePalette} />
    </div>
  );
}
