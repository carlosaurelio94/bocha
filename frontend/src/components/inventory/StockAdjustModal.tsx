'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Modal }      from '@/components/ui/Modal';
import { Input }      from '@/components/ui/Input';
import { Button }     from '@/components/ui/Button';
import { FilterTabs } from '@/components/ui/FilterTabs';
import { useAdjustStock } from '@/hooks/useInventory';
import { formatQty, getStockMovements, inventoryErrorMessage } from '@/lib/inventory';
import { cn } from '@/lib/utils';
import { parseAmount } from './amount';
import type { Product, StockMovementKind } from '@/types/inventory';

type Mode = 'purchase' | 'count';

const KIND_LABELS: Record<StockMovementKind, string> = {
  initial:     'Stock inicial',
  purchase:    'Compra',
  adjustment:  'Corrección',
  sale:        'Venta',
  sale_cancel: 'Venta anulada',
};

interface StockAdjustModalProps {
  product: Product | null;
  onClose: () => void;
}

export function StockAdjustModal({ product, onClose }: StockAdjustModalProps) {
  const adjust = useAdjustStock();
  const [mode, setMode]   = useState<Mode>('purchase');
  const [qty, setQty]     = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const { data: movements } = useQuery({
    queryKey: ['products', 'movements', product?.id],
    queryFn:  () => getStockMovements(product!.id),
    enabled:  !!product,
  });

  if (!product) return null;
  const current = Number(product.stock_current);

  const parsed = parseAmount(qty);
  const delta  = parsed === null ? null : mode === 'purchase' ? parsed : parsed - current;
  const after  = delta === null ? null : current + delta;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsed === null || parsed < 0 || (mode === 'purchase' && parsed === 0)) {
      setError(mode === 'purchase' ? 'Ingresá cuánto entró (mayor a 0).' : 'Ingresá cuánto hay (0 o más).');
      return;
    }
    if (delta === 0) { setError('Es la misma cantidad que ya está cargada.'); return; }
    setError('');
    try {
      await adjust.mutateAsync({
        productId: product.id,
        quantity:  delta!,
        kind:      mode === 'purchase' ? 'purchase' : 'adjustment',
        notes,
      });
      onClose();
    } catch (err) {
      setError(inventoryErrorMessage(err, 'No se pudo actualizar el stock. Probá de nuevo.'));
    }
  };

  return (
    <Modal open onClose={onClose} title={`Stock de ${product.name}`} description={`Hay ${formatQty(current)} ${product.unit} · mínimo ${formatQty(product.stock_min)}`}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <FilterTabs<Mode>
          value={mode}
          onChange={(m) => { setMode(m); setQty(''); setError(''); }}
          options={[
            { value: 'purchase', label: 'Llegó mercadería' },
            { value: 'count',    label: 'Corregir conteo'  },
          ]}
        />

        <Input
          id="stock-qty"
          label={mode === 'purchase' ? `¿Cuánto entró? (${product.unit})` : `¿Cuánto hay realmente? (${product.unit})`}
          inputMode="decimal"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          error={error || undefined}
          hint={after !== null && after >= 0 ? `Va a quedar en ${formatQty(after)} ${product.unit}.` : undefined}
        />
        <Input id="stock-notes" label="Nota (opcional)" placeholder={mode === 'purchase' ? 'Ej: Factura 123 de Insumos SA' : 'Ej: Conteo del viernes'} maxLength={200} value={notes} onChange={(e) => setNotes(e.target.value)} />

        <div className="flex flex-col-reverse gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end dark:border-slate-800">
          <Button type="button" variant="secondary" onClick={onClose} disabled={adjust.isPending}>Cancelar</Button>
          <Button type="submit" loading={adjust.isPending}>Guardar</Button>
        </div>
      </form>

      {movements && movements.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-slate-100">Últimos movimientos</h3>
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100 text-sm dark:divide-slate-800 dark:border-slate-800">
            {movements.slice(0, 10).map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block text-gray-800 dark:text-slate-200">{KIND_LABELS[m.kind]}</span>
                  <span className="block truncate text-xs text-gray-500 dark:text-slate-400">
                    {new Date(m.created_at).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' })}
                    {m.notes ? ` · ${m.notes}` : ''}
                  </span>
                </span>
                <span className={cn('font-medium tabular-nums', Number(m.quantity) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
                  {Number(m.quantity) >= 0 ? '+' : ''}{formatQty(m.quantity)}
                </span>
                <span className="w-14 text-right text-xs text-gray-500 tabular-nums dark:text-slate-400">= {formatQty(m.stock_after)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}
