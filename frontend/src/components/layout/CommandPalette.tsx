'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { CornerDownLeft, FilePlus2, Search, User, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';
import { useDebounce } from '@/hooks/useDebounce';
import { getClients } from '@/lib/clients';
import { navGroups } from './nav';

interface Command {
  id:      string;
  label:   string;
  hint?:   string;
  icon:    React.ElementType;
  href:    string;
  section: 'Acciones rápidas' | 'Ir a' | 'Clientes';
  keywords?: string;
}

interface CommandPaletteProps {
  open:    boolean;
  onClose: () => void;
}

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Buscador global (Ctrl/Cmd + K): saltar a cualquier sección, crear cosas
 * y encontrar clientes sin navegar menús.
 */
export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const { canView, hasPermission } = usePermissions();
  const [query, setQuery]   = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef  = useRef<HTMLDivElement>(null);
  const debounced = useDebounce(query.trim(), 200);

  const { data: clientResults } = useQuery({
    queryKey: ['command-palette', 'clients', debounced],
    queryFn:  () => getClients({ page: 1, pageSize: 5, search: debounced }),
    enabled:  open && debounced.length >= 2 && canView('clientes'),
    staleTime: 30_000,
  });

  const staticCommands = useMemo<Command[]>(() => {
    const actions: Command[] = [];
    if (hasPermission('presupuestos', 'crear')) {
      actions.push({ id: 'new-quote', label: 'Nuevo presupuesto', icon: FilePlus2, href: '/quotes/new', section: 'Acciones rápidas', keywords: 'crear cotizacion' });
    }
    if (hasPermission('clientes', 'crear')) {
      actions.push({ id: 'new-client', label: 'Nuevo cliente', icon: UserPlus, href: '/clients?nuevo=1', section: 'Acciones rápidas', keywords: 'crear agregar' });
    }
    const pages: Command[] = navGroups.flatMap((g) =>
      g.items
        .filter((i) => canView(i.module))
        .map((i) => ({
          id: i.href, label: i.label, hint: g.label ?? undefined, icon: i.icon,
          href: i.href, section: 'Ir a' as const, keywords: i.keywords,
        }))
    );
    return [...actions, ...pages];
  }, [canView, hasPermission]);

  const results = useMemo<Command[]>(() => {
    const q = normalize(query.trim());
    const filtered = q
      ? staticCommands.filter((c) => normalize(`${c.label} ${c.keywords ?? ''} ${c.hint ?? ''}`).includes(q))
      : staticCommands;
    const clients: Command[] = (q.length >= 2 ? clientResults?.data ?? [] : []).map((c) => ({
      id: `client-${c.id}`, label: c.name, hint: c.rif ?? undefined, icon: User,
      href: `/clients/${c.id}`, section: 'Clientes',
    }));
    return [...filtered, ...clients];
  }, [query, staticCommands, clientResults]);

  // Reset al abrir
  useEffect(() => {
    if (open) {
      setQuery(''); // eslint-disable-line react-hooks/set-state-in-effect
      setCursor(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => { setCursor(0); }, [query]); // eslint-disable-line react-hooks/set-state-in-effect

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${cursor}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  if (!open) return null;

  const run = (cmd: Command | undefined) => {
    if (!cmd) return;
    onClose();
    router.push(cmd.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, results.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    if (e.key === 'Enter')     { e.preventDefault(); run(results[cursor]); }
    if (e.key === 'Escape')    { e.preventDefault(); onClose(); }
  };

  let lastSection: string | null = null;

  return (
    <div
      className="animate-fade-in fixed inset-0 z-[60] flex items-start justify-center bg-gray-950/50 p-4 pt-[12vh] backdrop-blur-[2px]"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Buscador rápido"
        className="animate-slide-up w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900 dark:ring-1 dark:ring-slate-700"
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-gray-100 px-4 dark:border-slate-800">
          <Search className="h-5 w-5 text-gray-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="¿Qué querés hacer? Buscá una sección o un cliente…"
            className="h-14 flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-slate-100"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-list"
          />
          <kbd className="rounded border border-gray-200 px-1.5 text-[10px] text-gray-400 dark:border-slate-700">Esc</kbd>
        </div>

        <div ref={listRef} id="command-list" role="listbox" className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-gray-500 dark:text-slate-400">
              Sin resultados para “{query}”.
            </p>
          )}
          {results.map((cmd, i) => {
            const header = cmd.section !== lastSection ? cmd.section : null;
            lastSection = cmd.section;
            const Icon = cmd.icon;
            return (
              <div key={cmd.id}>
                {header && (
                  <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400 first:pt-1 dark:text-slate-500">
                    {header}
                  </p>
                )}
                <button
                  data-index={i}
                  role="option"
                  aria-selected={i === cursor}
                  onMouseMove={() => setCursor(i)}
                  onClick={() => run(cmd)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm',
                    i === cursor
                      ? 'bg-green-50 text-green-800 dark:bg-green-500/10 dark:text-green-300'
                      : 'text-gray-700 dark:text-slate-300'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-70" />
                  <span className="flex-1 truncate">{cmd.label}</span>
                  {cmd.hint && <span className="text-xs text-gray-400 dark:text-slate-500">{cmd.hint}</span>}
                  {i === cursor && <CornerDownLeft className="h-3.5 w-3.5 opacity-60" />}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
