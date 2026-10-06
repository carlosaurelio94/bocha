'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Trash2, ChevronDown, FileText } from 'lucide-react';
import { useQuotes, useUpdateQuoteStatus, useDeleteQuote } from '@/hooks/useQuotes';
import { useDebounce } from '@/hooks/useDebounce';
import { usePermissions } from '@/hooks/usePermissions';
import { Badge }       from '@/components/ui/Badge';
import { Button, LinkButton } from '@/components/ui/Button';
import { Card }        from '@/components/ui/Card';
import { Modal }       from '@/components/ui/Modal';
import { PageHeader }  from '@/components/ui/PageHeader';
import { SearchInput } from '@/components/ui/SearchInput';
import { FilterTabs }  from '@/components/ui/FilterTabs';
import { Pagination }  from '@/components/ui/Pagination';
import { EmptyState }  from '@/components/ui/EmptyState';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { formatDate, formatCurrency } from '@/lib/utils';
import type { Quote, QuoteStatus } from '@/types';

const PAGE_SIZE = 15;

const STATUS_OPTIONS: { value: QuoteStatus; label: string }[] = [
  { value: 'draft',    label: 'Borrador'  },
  { value: 'sent',     label: 'Enviado'   },
  { value: 'approved', label: 'Aprobado'  },
  { value: 'rejected', label: 'Rechazado' },
];

type StatusFilter = '' | QuoteStatus;
const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: '',         label: 'Todos'         },
  { value: 'draft',    label: 'Borradores'    },
  { value: 'sent',     label: 'Sin respuesta' },
  { value: 'approved', label: 'Aprobados'     },
  { value: 'rejected', label: 'Rechazados'    },
];

const isStatus = (v: string | null): v is QuoteStatus =>
  !!v && STATUS_OPTIONS.some((o) => o.value === v);

const quoteNumber = (n: number) => `#${String(n).padStart(4, '0')}`;

function DeleteModal({ quote, onClose }: { quote: Quote | null; onClose: () => void }) {
  const deleteMutation = useDeleteQuote();
  const handleDelete = async () => {
    if (!quote) return;
    await deleteMutation.mutateAsync(quote.id);
    onClose();
  };
  return (
    <Modal open={!!quote} onClose={onClose} title="Eliminar presupuesto" size="sm">
      <div className="flex flex-col gap-5">
        <p className="text-sm text-gray-600 dark:text-slate-300">
          ¿Eliminar el presupuesto{' '}
          <span className="font-semibold text-gray-900 dark:text-slate-100">{quote && quoteNumber(quote.quote_number)}</span>
          {quote?.client?.name && <> de <span className="font-semibold text-gray-900 dark:text-slate-100">{quote.client.name}</span></>}?
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={deleteMutation.isPending}>Cancelar</Button>
          <Button variant="danger" loading={deleteMutation.isPending} onClick={handleDelete}>Sí, eliminar</Button>
        </div>
      </div>
    </Modal>
  );
}

/** Badge que al tocarlo deja cambiar el estado sin entrar al detalle. */
function StatusSelector({ quote, editable }: { quote: Quote; editable: boolean }) {
  const updateStatus = useUpdateQuoteStatus();
  if (!editable) return <Badge variant={quote.status} />;
  return (
    <label className="relative inline-flex cursor-pointer items-center gap-0.5 rounded-full hover:opacity-80" title="Cambiar estado">
      <Badge variant={quote.status} />
      <ChevronDown className="h-3.5 w-3.5 text-gray-400 dark:text-slate-500" />
      <select
        value={quote.status}
        onChange={(e) => updateStatus.mutate({ id: quote.id, status: e.target.value as QuoteStatus })}
        disabled={updateStatus.isPending}
        className="absolute inset-0 w-full cursor-pointer opacity-0"
        aria-label="Cambiar estado"
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </label>
  );
}

function QuotesContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { hasPermission } = usePermissions();
  const initialStatus = searchParams.get('estado');

  const [page, setPage]                 = useState(1);
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(isStatus(initialStatus) ? initialStatus : '');
  const [deleteTarget, setDeleteTarget] = useState<Quote | null>(null);
  const debouncedSearch = useDebounce(search.trim());

  const { data, isLoading, isError, isFetching } = useQuotes({
    page, pageSize: PAGE_SIZE,
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
  });

  const canCreate = hasPermission('presupuestos', 'crear');
  const canEdit   = hasPermission('presupuestos', 'editar');
  const canDelete = hasPermission('presupuestos', 'eliminar');
  const filtering = !!debouncedSearch || !!statusFilter;

  const changeStatus = (v: StatusFilter) => {
    setStatusFilter(v);
    setPage(1);
    router.replace(v ? `/quotes?estado=${v}` : '/quotes', { scroll: false });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Presupuestos"
        description={data ? `${data.total} ${data.total === 1 ? 'presupuesto' : 'presupuestos'}${filtering ? ' con este filtro' : ''}` : 'Historial y seguimiento'}
        actions={canCreate && (
          <LinkButton href="/quotes/new">
            <Plus className="h-4 w-4" />
            Nuevo presupuesto
          </LinkButton>
        )}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterTabs value={statusFilter} onChange={changeStatus} options={STATUS_TABS} />
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Buscar por cliente" />
      </div>

      <Card flush className={isFetching && !isLoading ? 'opacity-70 transition-opacity' : 'transition-opacity'}>
        {isLoading ? (
          <ListSkeleton />
        ) : isError ? (
          <p className="px-6 py-12 text-center text-sm text-red-500">
            No pudimos cargar los presupuestos. Revisá tu conexión y recargá la página.
          </p>
        ) : data?.data.length === 0 ? (
          filtering ? (
            <EmptyState
              icon={FileText}
              title="Sin resultados"
              description="No hay presupuestos que coincidan con el filtro."
              action={<Button variant="secondary" onClick={() => { setSearch(''); changeStatus(''); }}>Ver todos</Button>}
            />
          ) : (
            <EmptyState
              icon={FileText}
              title="Todavía no hay presupuestos"
              description="Elegí un cliente, cargá los ítems y listo: lo podés exportar a PDF al instante."
              action={canCreate && <LinkButton href="/quotes/new"><Plus className="h-4 w-4" />Crear el primero</LinkButton>}
            />
          )
        ) : (
          <>
            {/* Desktop: tabla */}
            <table className="hidden min-w-full md:table">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="px-5 py-3">N°</th>
                  <th className="px-5 py-3">Cliente</th>
                  <th className="px-5 py-3">Fecha</th>
                  <th className="px-5 py-3 text-right">Ítems</th>
                  <th className="px-5 py-3 text-right">Total</th>
                  <th className="px-5 py-3">Estado</th>
                  <th className="px-5 py-3"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {data?.data.map((quote) => (
                  <tr key={quote.id}
                    className="cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-slate-800/60"
                    onClick={() => router.push(`/quotes/${quote.id}`)}>
                    <td className="px-5 py-3.5 font-mono text-sm text-gray-500 dark:text-slate-400">{quoteNumber(quote.quote_number)}</td>
                    <td className="px-5 py-3.5 text-sm font-medium text-gray-900 dark:text-slate-100">{quote.client?.name ?? '—'}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-500 dark:text-slate-400">{formatDate(quote.quote_date)}</td>
                    <td className="px-5 py-3.5 text-right text-sm text-gray-500 dark:text-slate-400">{quote.item_count}</td>
                    <td className="px-5 py-3.5 text-right text-sm font-semibold text-gray-900 dark:text-slate-100">
                      {formatCurrency(quote.total_amount, quote.currency)}
                    </td>
                    <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <StatusSelector quote={quote} editable={canEdit} />
                    </td>
                    <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                      {canDelete && (
                        <button
                          onClick={() => setDeleteTarget(quote)}
                          title="Eliminar"
                          aria-label={`Eliminar presupuesto ${quoteNumber(quote.quote_number)}`}
                          className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile: lista */}
            <ul className="divide-y divide-gray-100 md:hidden dark:divide-slate-800">
              {data?.data.map((quote) => (
                <li key={quote.id}>
                  <Link href={`/quotes/${quote.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-gray-50 dark:active:bg-slate-800">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-slate-100">{quote.client?.name ?? '—'}</p>
                      <p className="text-xs text-gray-500 dark:text-slate-400">
                        {quoteNumber(quote.quote_number)} · {formatDate(quote.quote_date)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">{formatCurrency(quote.total_amount, quote.currency)}</span>
                      <Badge variant={quote.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>

            <Pagination page={page} pageSize={PAGE_SIZE} total={data?.total ?? 0} onChange={setPage} />
          </>
        )}
      </Card>

      <DeleteModal quote={deleteTarget} onClose={() => setDeleteTarget(null)} />
    </div>
  );
}

export default function QuotesPage() {
  return (
    <Suspense fallback={null}>
      <QuotesContent />
    </Suspense>
  );
}
