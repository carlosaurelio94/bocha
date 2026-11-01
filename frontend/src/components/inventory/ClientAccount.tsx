'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, ShoppingCart } from 'lucide-react';
import { useSales } from '@/hooks/useInventory';
import { usePermissions } from '@/hooks/usePermissions';
import { getClientBalance } from '@/lib/inventory';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Button }     from '@/components/ui/Button';
import { Card }       from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { SaleForm } from './SaleForm';
import { SaleDetailModal } from './SaleDetailModal';
import { SaleStatusBadge } from './SaleStatusBadge';
import type { Sale } from '@/types/inventory';

/** La cuenta del cliente: lo que consumió y cuánto debe. */
export function ClientAccount({ clientId, clientName }: { clientId: string; clientName: string }) {
  const { canView, hasPermission } = usePermissions();
  const allowed = canView('ventas');
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<Sale | null>(null);

  const { data: sales } = useSales({ page: 1, pageSize: 20, clientId });
  const { data: balance } = useQuery({
    queryKey: ['sales', 'balance', clientId],
    queryFn:  () => getClientBalance(clientId),
    enabled:  allowed,
  });

  if (!allowed) return null;
  const canCreate = hasPermission('ventas', 'crear');

  return (
    <>
      <Card
        flush
        title={`Consumos (${sales?.total ?? 0})`}
        actions={
          <>
            {balance && balance.pending > 0 && (
              <span className="text-xs text-gray-500 dark:text-slate-400">
                Debe <span className="font-semibold text-amber-700 dark:text-amber-400">{formatCurrency(balance.pending)}</span>
              </span>
            )}
            {canCreate && (
              <Button size="sm" onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" />Registrar consumo</Button>
            )}
          </>
        }
      >
        {!sales || sales.data.length === 0 ? (
          <EmptyState icon={ShoppingCart} title="Sin consumos todavía" description={`Lo que compre ${clientName} queda acá, con lo que debe.`} />
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-slate-800">
            {sales.data.map((s) => (
              <li key={s.id}>
                <button onClick={() => setSelected(s)} className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-slate-800/60">
                  <span className="flex-1 text-sm text-gray-500 dark:text-slate-400">{formatDate(s.sale_date)} · {s.seller?.name ?? '—'}</span>
                  <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-slate-100">{formatCurrency(s.total)}</span>
                  <SaleStatusBadge status={s.status} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {formOpen && <SaleForm open clientId={clientId} onClose={() => setFormOpen(false)} />}
      {selected && <SaleDetailModal key={selected.id} sale={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
