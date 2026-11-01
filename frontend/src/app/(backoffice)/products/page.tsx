'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Package, PackagePlus, Pencil, Trash2, PlusCircle } from 'lucide-react';
import { useDeleteProduct, useProducts } from '@/hooks/useInventory';
import { useDebounce } from '@/hooks/useDebounce';
import { usePermissions } from '@/hooks/usePermissions';
import { ProductForm } from '@/components/inventory/ProductForm';
import { StockAdjustModal } from '@/components/inventory/StockAdjustModal';
import { StockBadge } from '@/components/inventory/StockBadge';
import { LowStockAlert } from '@/components/inventory/LowStockAlert';
import { Button }      from '@/components/ui/Button';
import { Card }        from '@/components/ui/Card';
import { Modal }       from '@/components/ui/Modal';
import { PageHeader }  from '@/components/ui/PageHeader';
import { SearchInput } from '@/components/ui/SearchInput';
import { FilterTabs }  from '@/components/ui/FilterTabs';
import { EmptyState }  from '@/components/ui/EmptyState';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { formatQty } from '@/lib/inventory';
import { cn, formatCurrency } from '@/lib/utils';
import type { Product } from '@/types/inventory';

type Filter = 'all' | 'low';

function ProductsContent() {
  const searchParams = useSearchParams();
  const { hasPermission } = usePermissions();
  const [filter, setFilter] = useState<Filter>(() => (searchParams.get('filtro') === 'bajo' ? 'low' : 'all'));
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search.trim());

  const [formOpen, setFormOpen]   = useState(false);
  const [editing, setEditing]     = useState<Product | null>(null);
  const [adjusting, setAdjusting] = useState<Product | null>(null);
  const [deleting, setDeleting]   = useState<Product | null>(null);
  const remove = useDeleteProduct();

  const { data: products, isLoading, isError } = useProducts({ search: debounced || undefined, lowOnly: filter === 'low' });

  const canCreate = hasPermission('productos', 'crear');
  const canEdit   = hasPermission('productos', 'editar');
  const canDelete = hasPermission('productos', 'eliminar');
  const filtering = !!debounced || filter === 'low';

  const openCreate = () => { setEditing(null); setFormOpen(true); };

  const actions = (p: Product) => (
    <div className="flex justify-end gap-1">
      {canEdit && (
        <button onClick={() => setAdjusting(p)} title="Agregar o corregir stock" aria-label={`Stock de ${p.name}`}
          className="rounded-lg p-2 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20">
          <PlusCircle className="h-4 w-4" />
        </button>
      )}
      {canEdit && (
        <button onClick={() => { setEditing(p); setFormOpen(true); }} title="Editar" aria-label={`Editar ${p.name}`}
          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-slate-700 dark:hover:text-slate-200">
          <Pencil className="h-4 w-4" />
        </button>
      )}
      {canDelete && (
        <button onClick={() => setDeleting(p)} title="Eliminar" aria-label={`Eliminar ${p.name}`}
          className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400">
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Productos y stock"
        description={products ? `${products.length} ${products.length === 1 ? 'producto' : 'productos'}${filtering ? ' con este filtro' : ''}` : 'Lo que vendés y cuánto te queda'}
        actions={canCreate && <Button onClick={openCreate}><PackagePlus className="h-4 w-4" />Nuevo producto</Button>}
      />

      {filter === 'all' && <LowStockAlert showLink={false} />}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterTabs<Filter> value={filter} onChange={setFilter} options={[
          { value: 'all', label: 'Todos' },
          { value: 'low', label: 'Comprar más' },
        ]} />
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nombre o código" />
      </div>

      <Card flush>
        {isLoading ? (
          <ListSkeleton />
        ) : isError ? (
          <p className="px-6 py-12 text-center text-sm text-red-500">No pudimos cargar los productos. Recargá la página.</p>
        ) : !products || products.length === 0 ? (
          filtering ? (
            <EmptyState icon={Package}
              title={filter === 'low' ? 'Todo en orden' : 'Sin resultados'}
              description={filter === 'low' ? 'Ningún producto llegó al stock mínimo.' : 'Probá con otra búsqueda.'} />
          ) : (
            <EmptyState icon={Package} title="Todavía no cargaste productos"
              description="Cargá lo que vendés con su stock actual y el mínimo; te avisamos cuando haya que comprar."
              action={canCreate && <Button onClick={openCreate}><PackagePlus className="h-4 w-4" />Cargar el primero</Button>} />
          )
        ) : (
          <>
            <table className="hidden min-w-full md:table">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="px-5 py-3">Producto</th>
                  <th className="px-5 py-3 text-right">Precio</th>
                  <th className="px-5 py-3 text-right">Stock actual</th>
                  <th className="px-5 py-3 text-right">Mínimo</th>
                  <th className="px-5 py-3">Estado</th>
                  <th className="px-5 py-3"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/60">
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900 dark:text-slate-100">{p.name}</p>
                      {p.sku && <p className="text-xs text-gray-500 dark:text-slate-400">{p.sku}</p>}
                    </td>
                    <td className="px-5 py-3 text-right text-sm tabular-nums text-gray-700 dark:text-slate-300">{formatCurrency(Number(p.price))}</td>
                    <td className={cn('px-5 py-3 text-right text-sm font-semibold tabular-nums',
                      Number(p.stock_current) <= Number(p.stock_min) ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-slate-100')}>
                      {formatQty(p.stock_current)} <span className="font-normal text-gray-500 dark:text-slate-400">{p.unit}</span>
                    </td>
                    <td className="px-5 py-3 text-right text-sm tabular-nums text-gray-500 dark:text-slate-400">{formatQty(p.stock_min)}</td>
                    <td className="px-5 py-3"><StockBadge product={p} /></td>
                    <td className="px-5 py-3">{actions(p)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ul className="divide-y divide-gray-100 md:hidden dark:divide-slate-800">
              {products.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-slate-100">{p.name}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      Hay {formatQty(p.stock_current)} {p.unit} · mín. {formatQty(p.stock_min)} · {formatCurrency(Number(p.price))}
                    </p>
                    <StockBadge product={p} className="mt-1" />
                  </div>
                  {actions(p)}
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      {formOpen && <ProductForm key={editing?.id ?? 'new'} open onClose={() => setFormOpen(false)} product={editing} />}
      {adjusting && <StockAdjustModal key={adjusting.id} product={adjusting} onClose={() => setAdjusting(null)} />}

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Eliminar producto" size="sm">
        <p className="text-sm text-gray-600 dark:text-slate-300">
          <span className="font-semibold text-gray-900 dark:text-slate-100">{deleting?.name}</span> deja de aparecer para vender.
          Las ventas que ya tiene se mantienen.
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => setDeleting(null)} disabled={remove.isPending}>Cancelar</Button>
          <Button variant="danger" loading={remove.isPending}
            onClick={() => deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}>
            Sí, eliminar
          </Button>
        </div>
      </Modal>
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={null}>
      <ProductsContent />
    </Suspense>
  );
}
