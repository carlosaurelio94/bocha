'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Pencil, Trash2, UserPlus, Users, Phone } from 'lucide-react';
import { useClients } from '@/hooks/useClients';
import { useDebounce } from '@/hooks/useDebounce';
import { usePermissions } from '@/hooks/usePermissions';
import { ClientForm } from '@/components/clients/ClientForm';
import { DeleteConfirmModal } from '@/components/clients/DeleteConfirmModal';
import { Avatar }      from '@/components/ui/Avatar';
import { Badge }       from '@/components/ui/Badge';
import { Button }      from '@/components/ui/Button';
import { Card }        from '@/components/ui/Card';
import { PageHeader }  from '@/components/ui/PageHeader';
import { SearchInput } from '@/components/ui/SearchInput';
import { FilterTabs }  from '@/components/ui/FilterTabs';
import { Pagination }  from '@/components/ui/Pagination';
import { EmptyState }  from '@/components/ui/EmptyState';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { formatDate } from '@/lib/utils';
import type { Client } from '@/types';

const PAGE_SIZE = 15;

type StatusFilter = '' | 'prospect' | 'client';
const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: '',         label: 'Todos'      },
  { value: 'client',   label: 'Clientes'   },
  { value: 'prospect', label: 'Prospectos' },
];

function ClientsContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { hasPermission } = usePermissions();

  const [page, setPage]                 = useState(1);
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  // /clients?nuevo=1 (desde el dashboard o Ctrl+K) abre directo el formulario
  const [formOpen, setFormOpen]         = useState(() => searchParams.get('nuevo') === '1');
  const [deleteOpen, setDeleteOpen]     = useState(false);
  const [selected, setSelected]         = useState<Client | null>(null);
  const debouncedSearch = useDebounce(search.trim());

  const { data, isLoading, isError, isFetching } = useClients({
    page, pageSize: PAGE_SIZE,
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
  });

  const openCreate = useCallback(() => { setSelected(null); setFormOpen(true); }, []);
  const openEdit   = useCallback((c: Client) => { setSelected(c); setFormOpen(true); }, []);
  const openDelete = useCallback((c: Client) => { setSelected(c); setDeleteOpen(true); }, []);

  // Si ya estamos en /clients y llega ?nuevo=1 (Ctrl+K), abrimos el form y limpiamos la URL
  const wantsNew = searchParams.get('nuevo') === '1';
  useEffect(() => {
    if (wantsNew) router.replace('/clients', { scroll: false });
  }, [wantsNew, router]);
  const [lastWantsNew, setLastWantsNew] = useState(wantsNew);
  if (wantsNew !== lastWantsNew) {
    setLastWantsNew(wantsNew);
    if (wantsNew) { setSelected(null); setFormOpen(true); }
  }

  const canCreate = hasPermission('clientes', 'crear');
  const canEdit   = hasPermission('clientes', 'editar');
  const canDelete = hasPermission('clientes', 'eliminar');
  const filtering = !!debouncedSearch || !!statusFilter;

  const rowActions = (client: Client) => (
    <div className="flex justify-end gap-1">
      {canEdit && (
        <button onClick={() => openEdit(client)} title="Editar" aria-label={`Editar ${client.name}`}
          className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-slate-700 dark:hover:text-slate-200">
          <Pencil className="h-4 w-4" />
        </button>
      )}
      {canDelete && (
        <button onClick={() => openDelete(client)} title="Eliminar" aria-label={`Eliminar ${client.name}`}
          className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400">
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Clientes"
        description={data ? `${data.total} ${data.total === 1 ? 'registro' : 'registros'}${filtering ? ' con este filtro' : ''}` : 'Tus clientes y prospectos'}
        actions={canCreate && (
          <Button onClick={openCreate}>
            <UserPlus className="h-4 w-4" />
            Nuevo cliente
          </Button>
        )}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterTabs value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} options={STATUS_TABS} />
        <SearchInput
          value={search}
          onChange={(v) => { setSearch(v); setPage(1); }}
          placeholder="Buscar por nombre, RIF o teléfono"
        />
      </div>

      <Card flush className={isFetching && !isLoading ? 'opacity-70 transition-opacity' : 'transition-opacity'}>
        {isLoading ? (
          <ListSkeleton />
        ) : isError ? (
          <p className="px-6 py-12 text-center text-sm text-red-500">
            No pudimos cargar los clientes. Revisá tu conexión y recargá la página.
          </p>
        ) : data?.data.length === 0 ? (
          filtering ? (
            <EmptyState
              icon={Users}
              title="Sin resultados"
              description="No encontramos clientes con ese criterio. Probá con otra búsqueda."
              action={<Button variant="secondary" onClick={() => { setSearch(''); setStatusFilter(''); }}>Limpiar filtros</Button>}
            />
          ) : (
            <EmptyState
              icon={Users}
              title="Todavía no tenés clientes"
              description="Cargá tu primer cliente para empezar a armarle presupuestos."
              action={canCreate && <Button onClick={openCreate}><UserPlus className="h-4 w-4" />Crear el primero</Button>}
            />
          )
        ) : (
          <>
            {/* Desktop: tabla */}
            <table className="hidden min-w-full md:table">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="px-5 py-3">Nombre</th>
                  <th className="px-5 py-3">RIF</th>
                  <th className="px-5 py-3">Teléfono</th>
                  <th className="px-5 py-3">Estado</th>
                  <th className="px-5 py-3">Alta</th>
                  <th className="px-5 py-3"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {data?.data.map((client) => (
                  <tr key={client.id}
                    className="cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-slate-800/60"
                    onClick={() => router.push(`/clients/${client.id}`)}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={client.name} />
                        <span className="font-medium text-gray-900 dark:text-slate-100">{client.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-500 dark:text-slate-400">{client.rif ?? '—'}</td>
                    <td className="px-5 py-3 text-sm text-gray-500 dark:text-slate-400">{client.phone ?? '—'}</td>
                    <td className="px-5 py-3"><Badge variant={client.client_status} /></td>
                    <td className="px-5 py-3 text-sm text-gray-500 dark:text-slate-400">{formatDate(client.created_at)}</td>
                    <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>{rowActions(client)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile: lista */}
            <ul className="divide-y divide-gray-100 md:hidden dark:divide-slate-800">
              {data?.data.map((client) => (
                <li key={client.id}>
                  <Link href={`/clients/${client.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-gray-50 dark:active:bg-slate-800">
                    <Avatar name={client.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-slate-100">{client.name}</p>
                      <p className="flex items-center gap-1 truncate text-xs text-gray-500 dark:text-slate-400">
                        {client.phone ? <><Phone className="h-3 w-3" />{client.phone}</> : (client.rif ?? 'Sin datos de contacto')}
                      </p>
                    </div>
                    <Badge variant={client.client_status} />
                  </Link>
                </li>
              ))}
            </ul>

            <Pagination page={page} pageSize={PAGE_SIZE} total={data?.total ?? 0} onChange={setPage} />
          </>
        )}
      </Card>

      <ClientForm open={formOpen} onClose={() => setFormOpen(false)} client={selected} />
      <DeleteConfirmModal open={deleteOpen} onClose={() => setDeleteOpen(false)} client={selected} />
    </div>
  );
}

export default function ClientsPage() {
  return (
    <Suspense fallback={null}>
      <ClientsContent />
    </Suspense>
  );
}
