'use client';

import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { useLowStock } from '@/hooks/useInventory';
import { usePermissions } from '@/hooks/usePermissions';
import { formatQty } from '@/lib/inventory';

/** Aviso de "hay que comprar": productos que llegaron al stock mínimo. */
export function LowStockAlert({ showLink = true }: { showLink?: boolean }) {
  const { canView } = usePermissions();
  const enabled = canView('productos');
  const { data } = useLowStock(enabled);

  if (!enabled || !data || data.length === 0) return null;

  const shown = data.slice(0, 4);
  const rest  = data.length - shown.length;

  return (
    <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-start dark:border-amber-500/30 dark:bg-amber-500/10">
      <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
          {data.length === 1 ? 'Hay que comprar 1 producto' : `Hay que comprar ${data.length} productos`}
        </p>
        <p className="mt-1 text-sm text-amber-800 dark:text-amber-300/90">
          {shown.map((p) => `${p.name} (${Number(p.stock_current) <= 0 ? 'sin stock' : `quedan ${formatQty(p.stock_current)}, mínimo ${formatQty(p.stock_min)}`})`).join(' · ')}
          {rest > 0 && ` · y ${rest} más`}
        </p>
      </div>
      {showLink && (
        <Link href="/products?filtro=bajo" className="shrink-0 text-sm font-semibold text-amber-900 underline-offset-2 hover:underline dark:text-amber-200">
          Ver productos
        </Link>
      )}
    </div>
  );
}
