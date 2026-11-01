'use client';

import { useState } from 'react';
import { Modal }  from '@/components/ui/Modal';
import { Input }  from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useSaveProduct } from '@/hooks/useInventory';
import { inventoryErrorMessage, formatQty } from '@/lib/inventory';
import { parseAmount } from './amount';
import type { Product } from '@/types/inventory';

const UNITS = ['unidad', 'kg', 'g', 'litro', 'ml', 'caja', 'paquete', 'docena'];

interface ProductFormProps {
  open:     boolean;
  onClose:  () => void;
  product?: Product | null;
}

type Field = 'name' | 'sku' | 'unit' | 'price' | 'stock_current' | 'stock_min';

function initialValues(product?: Product | null): Record<Field, string> {
  return {
    name:          product?.name ?? '',
    sku:           product?.sku ?? '',
    unit:          product?.unit ?? 'unidad',
    price:         product ? String(product.price) : '',
    stock_current: product ? String(product.stock_current) : '',
    stock_min:     product ? String(product.stock_min) : '',
  };
}

export function ProductForm({ open, onClose, product }: ProductFormProps) {
  // El form se vuelve a montar con cada producto (key en el padre), así que
  // el estado inicial alcanza.
  const isEditing = !!product;
  const save = useSaveProduct();
  const [values, setValues] = useState(() => initialValues(product));
  const [errors, setErrors] = useState<Partial<Record<Field | 'form', string>>>({});

  const set = (k: Field) => (e: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    const name  = values.name.trim();
    const unit  = values.unit.trim() || 'unidad';
    const price = values.price.trim() === '' ? 0 : parseAmount(values.price);
    const min   = values.stock_min.trim() === '' ? 0 : parseAmount(values.stock_min);
    const stock = values.stock_current.trim() === '' ? 0 : parseAmount(values.stock_current);

    if (!name)                     next.name = 'Poné un nombre.';
    else if (name.length > 120)    next.name = 'Máximo 120 caracteres.';
    if (values.sku.trim().length > 40) next.sku = 'Máximo 40 caracteres.';
    if (unit.length > 20)          next.unit = 'Máximo 20 caracteres.';
    if (price === null || price < 0) next.price = 'Precio inválido (ej: 1,50).';
    if (min === null || min < 0)   next.stock_min = 'Cantidad inválida.';
    if (!isEditing && (stock === null || stock < 0)) next.stock_current = 'Cantidad inválida.';

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const dto = { name, sku: values.sku.trim() || null, unit, price: price!, stock_min: min! };
    try {
      await save.mutateAsync({ id: product?.id, dto: isEditing ? dto : { ...dto, stock_current: stock! } });
      onClose();
    } catch (error) {
      setErrors({ form: inventoryErrorMessage(error, 'No se pudo guardar el producto. Probá de nuevo.') });
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? 'Editar producto' : 'Nuevo producto'}
      description={isEditing ? undefined : 'Cuando el stock llegue al mínimo, te avisamos que hay que comprar más.'}
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Input id="product-name" label="Nombre" required placeholder="Ej: Empanada de carne" value={values.name} onChange={set('name')} error={errors.name} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input id="product-sku" label="Código (opcional)" placeholder="Ej: EMP-001" value={values.sku} onChange={set('sku')} error={errors.sku} />
          <div>
            <Input id="product-unit" label="Unidad" list="product-units" value={values.unit} onChange={set('unit')} error={errors.unit} />
            <datalist id="product-units">{UNITS.map((u) => <option key={u} value={u} />)}</datalist>
          </div>
        </div>

        <Input id="product-price" label="Precio de venta ($)" inputMode="decimal" placeholder="0,00" value={values.price} onChange={set('price')} error={errors.price} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {isEditing ? (
            <Input
              id="product-stock"
              label="Stock actual"
              value={formatQty(product!.stock_current)}
              disabled
              hint="Se cambia con “Agregar stock” o al vender."
            />
          ) : (
            <Input id="product-stock" label="Stock actual" inputMode="decimal" placeholder="0" value={values.stock_current} onChange={set('stock_current')} error={errors.stock_current} hint="Lo que tenés hoy." />
          )}
          <Input id="product-min" label="Stock mínimo" inputMode="decimal" placeholder="0" value={values.stock_min} onChange={set('stock_min')} error={errors.stock_min} hint="Al llegar a esto, avisamos." />
        </div>

        {errors.form && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">{errors.form}</p>}

        <div className="flex flex-col-reverse gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end dark:border-slate-800">
          <Button type="button" variant="secondary" onClick={onClose} disabled={save.isPending}>Cancelar</Button>
          <Button type="submit" loading={save.isPending}>{isEditing ? 'Guardar cambios' : 'Crear producto'}</Button>
        </div>
      </form>
    </Modal>
  );
}
