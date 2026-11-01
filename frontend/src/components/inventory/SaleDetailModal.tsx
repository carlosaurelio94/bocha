'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Modal }  from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useCancelSale, useSetSaleStatus } from '@/hooks/useInventory';
import { usePermissions } from '@/hooks/usePermissions';
import { formatQty, getSaleItems } from '@/lib/inventory';
import { formatCurrency, formatDate } from '@/lib/utils';
import { SaleStatusBadge } from './SaleStatusBadge';
import type { Sale } from '@/types/inventory';

export function SaleDetailModal({ sale, onClose }: { sale: Sale | null; onClose: () => void }) {
  const { hasPermission } = usePermissions();
  const setStatus = useSetSaleStatus();
  const cancel    = useCancelSale();
  const [confirmCancel, setConfirmCancel] = useState(false);

  const { data: items, isLoading } = useQuery({
    queryKey: ['sales', 'items', sale?.id],
    queryFn:  () => getSaleItems(sale!.id),
    enabled:  !!sale,
  });

  if (!sale) return null;

  const toggleStatus = async () => {
    try {
      await setStatus.mutateAsync({ id: sale.id, status: sale.status === 'paid' ? 'pending' : 'paid' });
      onClose();
    } catch { /* el hook avisa */ }
  };

  const handleCancel = async () => {
    try {
      await cancel.mutateAsync(sale.id);
      onClose();
    } catch { /* el hook avisa */ }
  };

  return (
    <Modal open onClose={onClose} title={`Venta del ${formatDate(sale.sale_date)}`} description={sale.client?.name ?? 'Venta al mostrador'}>
      <div className="flex flex-col gap-5">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-xs text-gray-500 dark:text-slate-400">Vendedor</dt><dd className="font-medium text-gray-900 dark:text-slate-100">{sale.seller?.name ?? '—'}</dd></div>
          <div><dt className="text-xs text-gray-500 dark:text-slate-400">Estado</dt><dd><SaleStatusBadge status={sale.status} /></dd></div>
          {sale.notes && <div className="col-span-2"><dt className="text-xs text-gray-500 dark:text-slate-400">Nota</dt><dd className="text-gray-800 dark:text-slate-200">{sale.notes}</dd></div>}
        </dl>

        {isLoading ? (
          <Skeleton className="h-24 rounded-xl" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500 dark:border-slate-800 dark:text-slate-400">
                <th className="py-2 font-medium">Producto</th>
                <th className="py-2 text-right font-medium">Cant.</th>
                <th className="py-2 text-right font-medium">Precio</th>
                <th className="py-2 text-right font-medium">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {(items ?? []).map((it) => (
                <tr key={it.id}>
                  <td className="py-2 text-gray-900 dark:text-slate-100">{it.product?.name ?? 'Producto eliminado'}</td>
                  <td className="py-2 text-right tabular-nums">{formatQty(it.quantity)}</td>
                  <td className="py-2 text-right tabular-nums">{formatCurrency(Number(it.unit_price))}</td>
                  <td className="py-2 text-right tabular-nums">{formatCurrency(Number(it.total))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="pt-3 text-right text-sm font-medium text-gray-500 dark:text-slate-400">Total</td>
                <td className="pt-3 text-right text-base font-bold tabular-nums text-gray-900 dark:text-slate-100">{formatCurrency(sale.total)}</td>
              </tr>
            </tfoot>
          </table>
        )}

        {confirmCancel ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-500/30 dark:bg-red-500/10">
            <p className="text-sm text-red-800 dark:text-red-300">¿Anular esta venta? Los productos vuelven al stock y deja de contar en las métricas.</p>
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setConfirmCancel(false)} disabled={cancel.isPending}>No</Button>
              <Button variant="danger" size="sm" onClick={handleCancel} loading={cancel.isPending}>Sí, anular</Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col-reverse gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end dark:border-slate-800">
            {hasPermission('ventas', 'eliminar') && (
              <Button variant="ghost" className="text-red-600 sm:mr-auto" onClick={() => setConfirmCancel(true)}>Anular venta</Button>
            )}
            {hasPermission('ventas', 'editar') && (
              <Button variant={sale.status === 'paid' ? 'secondary' : 'primary'} onClick={toggleStatus} loading={setStatus.isPending}>
                {sale.status === 'paid' ? 'Volver a "a cuenta"' : 'Marcar como pagada'}
              </Button>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
