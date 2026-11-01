'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Input }  from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { inventoryKeys } from '@/hooks/useInventory';
import { createProduct, inventoryErrorMessage } from '@/lib/inventory';
import { parseAmount } from './amount';
import type { Product } from '@/types/inventory';

interface QuickProductFormProps {
  onCreated: (product: Product) => void;
  onCancel:  () => void;
}

/**
 * Alta rápida de un producto sin salir del formulario de venta. No es un
 * modal: va dentro del de la venta (dos modales apilados pelean por el foco).
 */
export function QuickProductForm({ onCreated, onCancel }: QuickProductFormProps) {
  const qc = useQueryClient();
  const [name, setName]   = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [min, setMin]     = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Es un <div> y no un <form>: no se puede anidar dentro del form de la venta.
  const handleSave = async () => {
    const trimmed = name.trim();
    const p = price.trim() === '' ? 0 : parseAmount(price);
    const s = stock.trim() === '' ? 0 : parseAmount(stock);
    const m = min.trim() === '' ? 0 : parseAmount(min);
    if (!trimmed)                 { setError('Poné un nombre.'); return; }
    if (trimmed.length > 120)     { setError('Máximo 120 caracteres.'); return; }
    if (p === null || p < 0)      { setError('Precio inválido (ej: 1,50).'); return; }
    if (s === null || s < 0)      { setError('Stock inválido.'); return; }
    if (m === null || m < 0)      { setError('Stock mínimo inválido.'); return; }

    setError('');
    setSaving(true);
    try {
      const product = await createProduct({ name: trimmed, sku: null, unit: 'unidad', price: p, stock_current: s, stock_min: m });
      // Esperar a que la lista tenga el producto antes de seleccionarlo
      await qc.invalidateQueries({ queryKey: inventoryKeys.products });
      toast.success(`${product.name} creado`);
      onCreated(product);
    } catch (err) {
      setError(inventoryErrorMessage(err, 'No se pudo crear el producto. Probá de nuevo.'));
    } finally {
      setSaving(false);
    }
  };

  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); void handleSave(); }
  };

  return (
    <div className="rounded-xl border border-dashed border-green-300 bg-green-50/40 p-4 dark:border-green-700 dark:bg-green-500/5" onKeyDown={onEnter}>
      <p className="mb-3 text-sm font-semibold text-gray-900 dark:text-slate-100">Nuevo producto</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="col-span-2">
          <Input id="quick-product-name" label="Nombre" required placeholder="Ej: Empanada de carne" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <Input id="quick-product-price" label="Precio ($)" inputMode="decimal" placeholder="0,00" value={price} onChange={(e) => setPrice(e.target.value)} />
        <Input id="quick-product-stock" label="Stock actual" inputMode="decimal" placeholder="0" value={stock} onChange={(e) => setStock(e.target.value)} />
        <div className="col-span-2 sm:col-span-1">
          <Input id="quick-product-min" label="Stock mínimo" inputMode="decimal" placeholder="0" value={min} onChange={(e) => setMin(e.target.value)} />
        </div>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onCancel} disabled={saving}>Cancelar</Button>
        <Button type="button" size="sm" onClick={handleSave} loading={saving}>Crear y agregar a la venta</Button>
      </div>
    </div>
  );
}
