'use client';

import { Suspense, useState } from 'react';
import { ShoppingCart, Plus, UserCog } from 'lucide-react';
import { useSales, useSellers } from '@/hooks/useInventory';
import { usePermissions } from '@/hooks/usePermissions';
import { useUrlTrigger } from '@/hooks/useUrlTrigger';
import { SaleForm } from '@/components/inventory/SaleForm';
import { SaleDetailModal } from '@/components/inventory/SaleDetailModal';
import { SaleStatusBadge } from '@/components/inventory/SaleStatusBadge';
import { SellersModal } from '@/components/inventory/SellersModal';
import { Button }      from '@/components/ui/Button';
import { Card }        from '@/components/ui/Card';
import { PageHeader }  from '@/components/ui/PageHeader';
import { FilterTabs }  from '@/components/ui/FilterTabs';
import { Select }      from '@/components/ui/Select';
import { Pagination }  from '@/components/ui/Pagination';
import { EmptyState }  from '@/components/ui/EmptyState';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Sale, SaleStatus } from '@/types/inventory';

const PAGE_SIZE = 15;
type StatusFilter = '' | SaleStatus;

function SalesContent() {
  const { hasPermission } = usePermissions();
  const [page, setPage]         = useState(1);
  const [status, setStatus]     = useState<StatusFilter>('');
  const [sellerId, setSellerId] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [sellersOpen, setSellersOpen] = useState(false);
  const [selected, setSelected] = useState<Sale | null>(null);
  // /sales?nueva=1 (desde Ctrl+K) abre el formulario
  useUrlTrigger('nueva', '/sales', () => setFormOpen(true));

  const { data: sellers } = useSellers();
  const { data, isLoading, isError, isFetching } = useSales({
    page, pageSize: PAGE_SIZE, status: status || undefined, sellerId: sellerId || undefined,
  });

  const canCreate      = hasPermission('ventas', 'crear');
  const canEditSellers = hasPermission('ventas', 'editar');
  const filtering      = !!status || !!sellerId;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Ventas"
        description={data ? `${data.total} ${data.total === 1 ? 'venta' : 'ventas'}${filtering ? ' con este filtro' : ''}` : 'Lo que consumió cada cliente'}
        actions={
          <>
            <Button variant="secondary" onClick={() => setSellersOpen(true)}><UserCog className="h-4 w-4" />Vendedores</Button>
            {canCreate && <Button onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" />Registrar venta</Button>}
          </>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterTabs<StatusFilter> value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[
          { value: '',        label: 'Todas'    },
          { value: 'pending', label: 'A cuenta' },
          { value: 'paid',    label: 'Pagadas'  },
        ]} />
        <div className="sm:w-56">
          <Select aria-label="Filtrar por vendedor" value={sellerId} onChange={(e) => { setSellerId(e.target.value); setPage(1); }}>
            <option value="">Todos los vendedores</option>
            {(sellers ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}{s.active ? '' : ' (inactivo)'}</option>)}
          </Select>
        </div>
      </div>

      <Card flush className={isFetching && !isLoading ? 'opacity-70 transition-opacity' : 'transition-opacity'}>
        {isLoading ? (
          <ListSkeleton />
        ) : isError ? (
          <p className="px-6 py-12 text-center text-sm text-red-500">No pudimos cargar las ventas. Recargá la página.</p>
        ) : !data || data.data.length === 0 ? (
          <EmptyState icon={ShoppingCart}
            title={filtering ? 'Sin resultados' : 'Todavía no registraste ventas'}
            description={filtering ? 'No hay ventas con este filtro.' : 'Registrá lo que consume cada cliente: se descuenta del stock y queda a cuenta hasta que lo pague.'}
            action={!filtering && canCreate && <Button onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" />Registrar la primera</Button>} />
        ) : (
          <>
            <table className="hidden min-w-full md:table">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="px-5 py-3">Fecha</th>
                  <th className="px-5 py-3">Cliente</th>
                  <th className="px-5 py-3">Vendedor</th>
                  <th className="px-5 py-3 text-right">Total</th>
                  <th className="px-5 py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {data.data.map((s) => (
                  <tr key={s.id} onClick={() => setSelected(s)} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/60">
                    <td className="px-5 py-3 text-sm text-gray-500 dark:text-slate-400">{formatDate(s.sale_date)}</td>
                    <td className="px-5 py-3 text-sm font-medium text-gray-900 dark:text-slate-100">{s.client?.name ?? <span className="font-normal text-gray-400">Mostrador</span>}</td>
                    <td className="px-5 py-3 text-sm text-gray-600 dark:text-slate-300">{s.seller?.name ?? '—'}</td>
                    <td className="px-5 py-3 text-right text-sm font-semibold tabular-nums text-gray-900 dark:text-slate-100">{formatCurrency(s.total)}</td>
                    <td className="px-5 py-3"><SaleStatusBadge status={s.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ul className="divide-y divide-gray-100 md:hidden dark:divide-slate-800">
              {data.data.map((s) => (
                <li key={s.id}>
                  <button onClick={() => setSelected(s)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-gray-50 dark:active:bg-slate-800">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-slate-100">{s.client?.name ?? 'Mostrador'}</p>
                      <p className="truncate text-xs text-gray-500 dark:text-slate-400">{formatDate(s.sale_date)} · {s.seller?.name ?? '—'}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-slate-100">{formatCurrency(s.total)}</span>
                      <SaleStatusBadge status={s.status} />
                    </div>
                  </button>
                </li>
              ))}
            </ul>

            <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onChange={setPage} />
          </>
        )}
      </Card>

      {formOpen && <SaleForm open onClose={() => setFormOpen(false)} onManageSellers={() => { setFormOpen(false); setSellersOpen(true); }} />}
      <SellersModal open={sellersOpen} onClose={() => setSellersOpen(false)} canEdit={canEditSellers} />
      {selected && <SaleDetailModal key={selected.id} sale={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

export default function SalesPage() {
  return (
    <Suspense fallback={null}>
      <SalesContent />
    </Suspense>
  );
}
