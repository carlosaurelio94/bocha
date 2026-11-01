'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Modal }  from '@/components/ui/Modal';
import { Input }  from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { useProducts, useRegisterSale, useSellers } from '@/hooks/useInventory';
import { usePermissions } from '@/hooks/usePermissions';
import { formatQty, inventoryErrorMessage } from '@/lib/inventory';
import { cn, formatCurrency, toLocalISODate } from '@/lib/utils';
import { parseAmount } from './amount';
import { QuickProductForm } from './QuickProductForm';
import type { SaleStatus } from '@/types/inventory';

interface Line { key: number; productId: string; qty: string }

interface SaleFormProps {
  open:     boolean;
  onClose:  () => void;
  /** Cliente preseleccionado (p. ej. desde la ficha del cliente). */
  clientId?: string;
  /** Abre la gestión de vendedores cuando todavía no hay ninguno. */
  onManageSellers?: () => void;
}

async function getClientOptions() {
  const { data, error } = await supabase
    .from('clients').select('id, name').eq('deleted', false).order('name').limit(1000);
  if (error) throw error;
  return (data ?? []) as { id: string; name: string }[];
}

let nextKey = 1;
const newLine = (): Line => ({ key: nextKey++, productId: '', qty: '1' });

export function SaleForm({ open, onClose, clientId, onManageSellers }: SaleFormProps) {
  const register = useRegisterSale();
  const { hasPermission } = usePermissions();
  const canCreateProduct = hasPermission('productos', 'crear');
  const { data: sellers }  = useSellers();
  const { data: products } = useProducts();
  const { data: clients }  = useQuery({ queryKey: ['clients', 'options'], queryFn: getClientOptions, enabled: open });

  const [sellerId, setSellerId] = useState('');
  const [client, setClient]     = useState(clientId ?? '');
  const [date, setDate]         = useState(toLocalISODate());
  const [status, setStatus]     = useState<SaleStatus>('pending');
  const [notes, setNotes]       = useState('');
  const [lines, setLines]       = useState<Line[]>(() => [newLine()]);
  const [error, setError]       = useState('');
  const [creatingProduct, setCreatingProduct] = useState(false);

  const activeSellers = (sellers ?? []).filter((s) => s.active);
  const byId = useMemo(() => new Map((products ?? []).map((p) => [p.id, p])), [products]);

  const rows = lines.map((l) => {
    const product = byId.get(l.productId);
    const amount  = parseAmount(l.qty);
    const valid   = !!product && amount !== null && amount > 0;
    // Lo que ya se pidió de este producto en las líneas anteriores
    const already = lines
      .slice(0, lines.indexOf(l))
      .filter((o) => o.productId === l.productId)
      .reduce((s, o) => s + (parseAmount(o.qty) ?? 0), 0);
    const short = valid && amount! + already > Number(product!.stock_current);
    return { ...l, product, amount, valid, short, subtotal: valid ? amount! * Number(product!.price) : 0 };
  });
  const total = rows.reduce((s, r) => s + r.subtotal, 0);

  const updateLine = (key: number, changes: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...changes } : l)));

  /** El producto recién creado va en la primera línea vacía (o en una nueva). */
  const addCreatedProduct = (productId: string) => {
    setLines((ls) => {
      const empty = ls.find((l) => !l.productId);
      return empty
        ? ls.map((l) => (l.key === empty.key ? { ...l, productId } : l))
        : [...ls, { ...newLine(), productId }];
    });
    setCreatingProduct(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const filled = rows.filter((r) => r.productId);
    if (!sellerId)              { setError('Elegí quién hizo la venta.'); return; }
    if (filled.length === 0)    { setError('Agregá al menos un producto.'); return; }
    if (filled.some((r) => !r.valid)) { setError('Revisá las cantidades: tienen que ser mayores a 0.'); return; }
    if (filled.some((r) => r.short))  { setError('Hay productos sin stock suficiente.'); return; }
    setError('');
    try {
      await register.mutateAsync({
        seller_id: sellerId,
        client_id: client || null,
        sale_date: date,
        status,
        notes:     notes.trim() || null,
        items:     filled.map((r) => ({ product_id: r.productId, quantity: r.amount! })),
      });
      onClose();
    } catch (err) {
      setError(inventoryErrorMessage(err, 'No se pudo registrar la venta. Probá de nuevo.'));
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Registrar venta" description="Se descuenta del stock al guardar." size="lg">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Select id="sale-seller" label="Vendedor" required value={sellerId} onChange={(e) => setSellerId(e.target.value)}>
              <option value="">Elegí un vendedor</option>
              {activeSellers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            {sellers && activeSellers.length === 0 && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                No hay vendedores cargados.{' '}
                {onManageSellers && <button type="button" onClick={onManageSellers} className="font-semibold underline">Agregar uno</button>}
              </p>
            )}
          </div>
          <Select id="sale-client" label="Cliente" value={client} onChange={(e) => setClient(e.target.value)}>
            <option value="">Venta al mostrador (sin cliente)</option>
            {(clients ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Input id="sale-date" label="Fecha" type="date" value={date} max={toLocalISODate()} onChange={(e) => setDate(e.target.value)} />
          <fieldset>
            <legend className="mb-1 text-sm font-medium text-gray-700 dark:text-slate-300">Pago</legend>
            <div className="grid grid-cols-2 gap-2">
              {([['pending', 'A cuenta'], ['paid', 'Pagada']] as const).map(([value, label]) => (
                <label key={value} className={cn(
                  'flex cursor-pointer items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium',
                  status === value
                    ? 'border-green-600 bg-green-50 text-green-700 dark:border-green-500 dark:bg-green-500/10 dark:text-green-400'
                    : 'border-gray-300 text-gray-600 dark:border-slate-700 dark:text-slate-300',
                )}>
                  <input type="radio" name="sale-status" value={value} checked={status === value} onChange={() => setStatus(value)} className="sr-only" />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-gray-700 dark:text-slate-300">Productos</p>
          {products && products.length === 0 && !creatingProduct ? (
            <p className="rounded-lg bg-gray-50 px-3 py-4 text-center text-sm text-gray-500 dark:bg-slate-800 dark:text-slate-400">
              Todavía no hay productos.{' '}
              {canCreateProduct
                ? <button type="button" onClick={() => setCreatingProduct(true)} className="font-semibold text-green-700 underline dark:text-green-400">Crear el primero</button>
                : 'Pedile a un administrador que los cargue.'}
            </p>
          ) : products && products.length === 0 ? null : (
            <ul className="flex flex-col gap-2">
              {rows.map((r, i) => (
                <li key={r.key} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <Select aria-label={`Producto ${i + 1}`} value={r.productId} onChange={(e) => updateLine(r.key, { productId: e.target.value })}>
                        <option value="">Elegí un producto</option>
                        {(products ?? []).map((p) => (
                          <option key={p.id} value={p.id} disabled={Number(p.stock_current) <= 0}>
                            {p.name} — {formatCurrency(Number(p.price))} · {Number(p.stock_current) <= 0 ? 'sin stock' : `quedan ${formatQty(p.stock_current)}`}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="w-24">
                      <Input aria-label={`Cantidad ${i + 1}`} inputMode="decimal" value={r.qty} onChange={(e) => updateLine(r.key, { qty: e.target.value })} className="text-right" />
                    </div>
                    <span className="hidden w-24 text-right text-sm tabular-nums text-gray-700 sm:block dark:text-slate-300">
                      {r.valid ? formatCurrency(r.subtotal) : '—'}
                    </span>
                    <button type="button" aria-label={`Quitar producto ${i + 1}`} disabled={lines.length === 1}
                      onClick={() => setLines((ls) => ls.filter((l) => l.key !== r.key))}
                      className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 dark:hover:bg-red-900/30">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {r.short && (
                    <p className="text-xs text-red-600 dark:text-red-400">
                      Solo quedan {formatQty(r.product!.stock_current)} {r.product!.unit}.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
          {creatingProduct ? (
            <div className="mt-3">
              <QuickProductForm onCreated={(p) => addCreatedProduct(p.id)} onCancel={() => setCreatingProduct(false)} />
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap gap-1">
              {(products?.length ?? 0) > 0 && (
                <Button type="button" variant="ghost" size="sm" disabled={lines.length >= 100} onClick={() => setLines((ls) => [...ls, newLine()])}>
                  <Plus className="h-4 w-4" />Agregar otro producto
                </Button>
              )}
              {canCreateProduct && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setCreatingProduct(true)}>
                  <Plus className="h-4 w-4" />Crear producto nuevo
                </Button>
              )}
            </div>
          )}
        </div>

        <Input id="sale-notes" label="Nota (opcional)" maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />

        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">{error}</p>}

        <div className="flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Total <span className="ml-1 text-lg font-bold text-gray-900 tabular-nums dark:text-slate-100">{formatCurrency(total)}</span>
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="secondary" onClick={onClose} disabled={register.isPending}>Cancelar</Button>
            <Button type="submit" loading={register.isPending}>Registrar venta</Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
