'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, ClipboardPaste, UserPlus, ChevronDown } from 'lucide-react';
import { useCreateQuote, useNextQuoteNumber } from '@/hooks/useQuotes';
import { useClients } from '@/hooks/useClients';
import { useQuoteInformation } from '@/hooks/useQuoteInformation';
import { ClientForm } from '@/components/clients/ClientForm';
import { Input }  from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Modal }  from '@/components/ui/Modal';
import { Card }   from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { cn, formatCurrency } from '@/lib/utils';
import { parseItemsText, type ParsedItem } from '@/lib/parseItems';

// ─── Modal de importación ─────────────────────────────────────────────────────
function ImportModal({
  open,
  onClose,
  onImport,
}: {
  open:     boolean;
  onClose:  () => void;
  onImport: (items: ParsedItem[]) => void;
}) {
  const [text, setText]     = useState('');
  const [preview, setPreview] = useState<ReturnType<typeof parseItemsText>>([]);

  const handleChange = (val: string) => {
    setText(val);
    setPreview(parseItemsText(val));
  };

  const handleImport = () => {
    if (preview.length === 0) return;
    onImport(preview);
    setText('');
    setPreview([]);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Pegar lista de ítems" description="Ideal si ya tenés la lista en WhatsApp, Excel o un bloc de notas." size="lg">
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-sm text-gray-500 dark:text-slate-400 mb-2">
            Pegá la lista con el formato: <code className="rounded bg-gray-100 px-1 dark:bg-slate-700">cantidad producto precio</code> — una línea por ítem.
          </p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mb-3">
            Ej: <span className="font-mono">3 pandanus 2.5</span> · <span className="font-mono">1 ficus 150</span> · <span className="font-mono">5 metros 2x5 50</span>
          </p>
          <textarea
            rows={8}
            value={text}
            onChange={e => handleChange(e.target.value)}
            placeholder={'1 ficus 150\n3 pandanus 2.5\n5 metros 2x5 50'}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono
                       placeholder:text-gray-300 focus:border-green-500 focus:outline-none focus:ring-1
                       focus:ring-green-500 resize-y
                       dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-600"
          />
        </div>

        {/* Preview */}
        {preview.length > 0 && (
          <div className="rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
            <div className="bg-gray-50 dark:bg-slate-700/50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
              Vista previa — {preview.length} ítem{preview.length !== 1 ? 's' : ''} detectado{preview.length !== 1 ? 's' : ''}
            </div>
            <table className="min-w-full divide-y divide-gray-100 dark:divide-slate-700 text-sm">
              <thead className="bg-white dark:bg-slate-800">
                <tr>
                  {['Producto', 'Cant.', 'Precio unit.', 'Total'].map(h => (
                    <th key={h} className={`px-4 py-2 text-xs font-medium text-gray-500 dark:text-slate-400 ${h === 'Producto' ? 'text-left' : 'text-right'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700 bg-white dark:bg-slate-800">
                {preview.map((item, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2 text-gray-900 dark:text-slate-100">{item.product}</td>
                    <td className="px-4 py-2 text-right text-gray-600 dark:text-slate-300">{item.quantity}</td>
                    <td className="px-4 py-2 text-right text-gray-600 dark:text-slate-300">{item.unit_price}</td>
                    <td className="px-4 py-2 text-right font-semibold text-gray-900 dark:text-slate-100">{item.total_price.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {text.length > 0 && preview.length === 0 && (
          <p className="text-sm text-amber-600 dark:text-amber-400">
            No se detectaron ítems válidos. Revisá el formato: <span className="font-mono">cantidad producto precio</span>
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end dark:border-slate-800">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleImport} disabled={preview.length === 0}>
            <ClipboardPaste className="h-4 w-4" />
            Importar {preview.length > 0 ? `${preview.length} ítem${preview.length !== 1 ? 's' : ''}` : ''}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

const itemSchema = z.object({
  product:     z.string().min(1, 'Requerido'),
  quantity:    z.coerce.number().positive('Debe ser > 0'),
  unit_price:  z.coerce.number().min(0),
  total_price: z.coerce.number().min(0),
});

const quoteSchema = z.object({
  client_id:      z.string().min(1, 'Elegí a quién le cotizás'),
  information_id: z.string().optional(),
  quote_number:   z.coerce.number().positive(),
  quote_date:     z.string().min(1, 'Requerido'),
  currency:       z.enum(['$', 'Bs', '€']),
  status:         z.enum(['draft', 'sent', 'approved', 'rejected']),
  items:          z.array(itemSchema).min(1, 'Agregá al menos un ítem'),
});

type QuoteFormValues = z.infer<typeof quoteSchema>;
const emptyItem = { product: '', quantity: 1, unit_price: 0, total_price: 0 };

// Clases reutilizables para inputs de la grilla de ítems
const itemInputCls = 'block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';

function StepTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-600 text-[11px] font-bold text-white">{n}</span>
      {children}
    </span>
  );
}

function NewQuoteForm() {
  const router               = useRouter();
  const searchParams         = useSearchParams();
  const { data: nextNumber }  = useNextQuoteNumber();
  const { data: clientsData } = useClients({ page: 1, pageSize: 200 });
  const { data: infoList }    = useQuoteInformation();
  const createMutation        = useCreateQuote();

  const { register, control, handleSubmit, watch, setValue, setFocus, formState: { errors } } = useForm<QuoteFormValues>({
    resolver: zodResolver(quoteSchema),
    defaultValues: {
      client_id:    '',
      quote_number: 1,
      quote_date:   new Date().toISOString().slice(0, 10),
      currency:     '$',
      status:       'draft',
      items:        [emptyItem],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({ control, name: 'items' });
  const [importOpen, setImportOpen]         = useState(false);
  const [newClientOpen, setNewClientOpen]   = useState(false);

  // /quotes/new?cliente=<id> (desde la ficha del cliente) lo deja preseleccionado
  const [pendingClientId, setPendingClientId] = useState<string | null>(searchParams.get('cliente'));

  useEffect(() => { if (nextNumber) setValue('quote_number', nextNumber); }, [nextNumber, setValue]);

  const watchedItems = watch('items');
  const currency     = watch('currency');
  const grandTotal   = watchedItems?.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0), 0) ?? 0;
  const filledItems  = watchedItems?.filter((i) => i.product?.trim()).length ?? 0;

  // Un cliente recién creado aparece en el <select> cuando se refresca la lista;
  // recién ahí lo seleccionamos para que el valor visible coincida.
  useEffect(() => {
    if (pendingClientId && clientsData?.data.some((c) => c.id === pendingClientId)) {
      setValue('client_id', pendingClientId, { shouldValidate: true });
      setPendingClientId(null);
    }
  }, [pendingClientId, clientsData, setValue]);

  const handleImport = (items: ParsedItem[]) => {
    // Si solo hay una fila vacía, la reemplazamos; si no, sumamos al final.
    const onlyEmpty = fields.length === 1 && !watchedItems?.[0]?.product;
    if (onlyEmpty) replace(items); else append(items);
  };

  const handleItemChange = (index: number) => {
    const i = watchedItems[index];
    setValue(`items.${index}.total_price`, (Number(i.quantity) || 0) * (Number(i.unit_price) || 0));
  };

  const addItem = () => {
    append(emptyItem);
    // El foco va al producto de la fila nueva para seguir tipeando
    setTimeout(() => setFocus(`items.${fields.length}.product`), 0);
  };

  // Enter en el precio de la última fila agrega otra fila (carga rápida con teclado)
  const onPriceKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (index === fields.length - 1) addItem();
      else setFocus(`items.${index + 1}.product`);
    }
  };

  const onSubmit = async (values: QuoteFormValues) => {
    try {
      const created = await createMutation.mutateAsync({
        ...values,
        information_id: values.information_id || undefined,
        total_amount: grandTotal,
        item_count:   values.items.length,
      });
      router.push(created?.id ? `/quotes/${created.id}` : '/quotes');
    } catch {
      // El hook ya mostró el toast de error; no perdemos lo cargado.
    }
  };

  const hasClients = (clientsData?.data.length ?? 0) > 0;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 pb-28">
      <PageHeader
        backHref="/quotes"
        title="Nuevo presupuesto"
        description="Tres pasos: elegí el cliente, cargá los ítems y guardá."
      />

      <form id="quote-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">

        {/* Paso 1: cliente */}
        <Card title={<StepTitle n={1}>¿Para quién es?</StepTitle>}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
              <div className="flex-1">
                <Select aria-label="Cliente" error={errors.client_id?.message} {...register('client_id')}>
                  <option value="">{hasClients ? 'Elegí un cliente…' : 'Todavía no tenés clientes'}</option>
                  {clientsData?.data.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </div>
              <Button type="button" variant={hasClients ? 'secondary' : 'primary'} onClick={() => setNewClientOpen(true)}>
                <UserPlus className="h-4 w-4" />
                Nuevo cliente
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input label="Fecha" type="date" required error={errors.quote_date?.message} {...register('quote_date')} />
              <Select label="Moneda" required {...register('currency')}>
                <option value="$">$ Dólar</option>
                <option value="Bs">Bs Bolívares</option>
                <option value="€">€ Euro</option>
              </Select>
            </div>

            {/* Opciones menos usadas, plegadas para no abrumar */}
            <details className="group rounded-lg border border-gray-200 dark:border-slate-700">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 text-sm text-gray-600 dark:text-slate-400 [&::-webkit-details-marker]:hidden">
                Más opciones (número, estado{infoList && infoList.length > 0 ? ', texto informativo' : ''})
                <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
              </summary>
              <div className="grid grid-cols-1 gap-4 border-t border-gray-200 p-4 sm:grid-cols-2 dark:border-slate-700">
                <Input label="N° de presupuesto" type="number" required hint="Se completa solo con el siguiente número." error={errors.quote_number?.message} {...register('quote_number')} />
                <Select label="Estado" required {...register('status')}>
                  <option value="draft">Borrador</option>
                  <option value="sent">Enviado</option>
                  <option value="approved">Aprobado</option>
                  <option value="rejected">Rechazado</option>
                </Select>
                {infoList && infoList.length > 0 && (
                  <div className="sm:col-span-2">
                    <Select label="Texto informativo al pie" {...register('information_id')}>
                      <option value="">Sin texto adicional</option>
                      {infoList.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </Select>
                  </div>
                )}
              </div>
            </details>
          </div>
        </Card>

        {/* Paso 2: ítems */}
        <Card
          flush
          title={<StepTitle n={2}>¿Qué incluye?</StepTitle>}
          actions={
            <Button type="button" variant="ghost" size="sm" onClick={() => setImportOpen(true)}>
              <ClipboardPaste className="h-4 w-4" />
              <span className="hidden sm:inline">Pegar lista</span>
            </Button>
          }
        >
          <div>
            {/* Encabezados (solo desktop) */}
            <div className="hidden grid-cols-12 gap-3 border-b border-gray-100 px-5 py-2 text-xs font-medium text-gray-500 md:grid dark:border-slate-800 dark:text-slate-400">
              <span className="col-span-6">Producto o servicio</span>
              <span className="col-span-2 text-right">Cantidad</span>
              <span className="col-span-2 text-right">Precio unit.</span>
              <span className="col-span-2 text-right">Subtotal</span>
            </div>

            <ul className="divide-y divide-gray-100 dark:divide-slate-800">
              {fields.map((field, index) => {
                const subtotal = (Number(watchedItems?.[index]?.quantity) || 0) * (Number(watchedItems?.[index]?.unit_price) || 0);
                return (
                  <li key={field.id} className="grid grid-cols-12 items-start gap-3 px-4 py-3 md:px-5">
                    <div className="col-span-12 md:col-span-6">
                      <label className="mb-1 block text-xs text-gray-500 md:hidden dark:text-slate-400">Producto o servicio</label>
                      <div className="flex gap-2">
                        <input placeholder="Ej: Planta ornamental 40cm" className={itemInputCls} {...register(`items.${index}.product`)} />
                        <button type="button" onClick={() => remove(index)} disabled={fields.length === 1}
                          aria-label="Quitar ítem" title="Quitar ítem"
                          className="shrink-0 rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-30 md:order-last md:hidden dark:hover:bg-red-900/30 dark:hover:text-red-400">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      {errors.items?.[index]?.product && (
                        <p className="mt-1 text-xs text-red-500">{errors.items[index]?.product?.message}</p>
                      )}
                    </div>
                    <div className="col-span-4 md:col-span-2">
                      <label className="mb-1 block text-xs text-gray-500 md:hidden dark:text-slate-400">Cant.</label>
                      <input type="number" inputMode="decimal" min="0" step="any" className={cn(itemInputCls, 'text-right')}
                        {...register(`items.${index}.quantity`, { onChange: () => handleItemChange(index) })} />
                    </div>
                    <div className="col-span-4 md:col-span-2">
                      <label className="mb-1 block text-xs text-gray-500 md:hidden dark:text-slate-400">Precio</label>
                      <input type="number" inputMode="decimal" min="0" step="0.01" className={cn(itemInputCls, 'text-right')}
                        onKeyDown={(e) => onPriceKeyDown(e, index)}
                        {...register(`items.${index}.unit_price`, { onChange: () => handleItemChange(index) })} />
                    </div>
                    <div className="col-span-4 flex items-center justify-end gap-1 md:col-span-2">
                      <div className="text-right">
                        <span className="mb-1 block text-xs text-gray-500 md:hidden dark:text-slate-400">Subtotal</span>
                        <span className="block py-2 text-sm font-medium text-gray-900 dark:text-slate-100">{formatCurrency(subtotal, currency)}</span>
                      </div>
                      <button type="button" onClick={() => remove(index)} disabled={fields.length === 1}
                        aria-label="Quitar ítem" title="Quitar ítem"
                        className="hidden shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-30 md:block dark:hover:bg-red-900/30 dark:hover:text-red-400">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="flex flex-col gap-2 border-t border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between md:px-5 dark:border-slate-800">
              <Button type="button" variant="secondary" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4" />
                Agregar ítem
              </Button>
              <p className="text-xs text-gray-400 dark:text-slate-500">
                Tip: apretá <kbd className="rounded border border-gray-300 px-1 font-sans dark:border-slate-600">Enter</kbd> en el precio para agregar otra fila.
              </p>
            </div>
            {errors.items?.root?.message && <p className="px-5 pb-3 text-xs text-red-500">{errors.items.root.message}</p>}
          </div>
        </Card>
      </form>

      {/* Paso 3: barra fija con total y guardar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 backdrop-blur lg:left-64 dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Total · {filledItems} {filledItems === 1 ? 'ítem' : 'ítems'}
            </p>
            <p className="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl dark:text-slate-100">{formatCurrency(grandTotal, currency)}</p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" className="hidden sm:inline-flex" onClick={() => router.push('/quotes')} disabled={createMutation.isPending}>
              Cancelar
            </Button>
            <Button type="submit" form="quote-form" size="lg" loading={createMutation.isPending}>
              Guardar presupuesto
            </Button>
          </div>
        </div>
      </div>

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} onImport={handleImport} />
      <ClientForm
        open={newClientOpen}
        onClose={() => setNewClientOpen(false)}
        onSaved={(c) => setPendingClientId(c.id)}
      />
    </div>
  );
}

export default function NewQuotePage() {
  return (
    <Suspense fallback={null}>
      <NewQuoteForm />
    </Suspense>
  );
}
