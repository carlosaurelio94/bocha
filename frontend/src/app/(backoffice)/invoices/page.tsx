'use client';

import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Receipt, Plus, Info, FileStack, X, Loader2,
  CheckCircle, XCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button }      from '@/components/ui/Button';
import { Card }        from '@/components/ui/Card';
import { PageHeader }  from '@/components/ui/PageHeader';
import { SearchInput } from '@/components/ui/SearchInput';
import { Pagination }  from '@/components/ui/Pagination';
import { EmptyState }  from '@/components/ui/EmptyState';
import type {
  Invoice, InvoiceStatus, InvoiceStatusHistory,
  Supplier, InvoiceType, PaymentMethod, Currency,
} from '@/types/suppliers';
import {
  STATUS_COLORS, DEFAULT_STATUS_COLOR,
  INVOICE_TYPE_LABELS, PAYMENT_METHOD_LABELS, CURRENCY_LABELS, REJECTION_TYPES,
} from '@/types/suppliers';

const PAGE_SIZE = 15;

// ─── Helpers ──────────────────────────────────────────────────
function fmt(n: number | null | undefined, currency = 'ARS') {
  if (n == null) return '—';
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency, maximumFractionDigits: 2 }).format(n);
}
function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('es-AR');
}

// ─── Status Badge ──────────────────────────────────────────────
function StatusBadge({ statusId, statusName }: { statusId: number; statusName: string }) {
  const c = STATUS_COLORS[statusId] ?? DEFAULT_STATUS_COLOR;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${c.bg} ${c.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {statusName}
    </span>
  );
}

// ─── Modal Detalle Factura ─────────────────────────────────────
interface InvoiceDetailModalProps {
  invoice:   Invoice;
  statuses:  InvoiceStatus[];
  onClose:   () => void;
  onRefresh: () => void;
}

function InvoiceDetailModal({ invoice, statuses, onClose, onRefresh }: InvoiceDetailModalProps) {
  const [tab,      setTab]      = useState<'info' | 'history'>('info');
  const [history,  setHistory]  = useState<InvoiceStatusHistory[]>([]);
  const [showReject, setShowReject] = useState(false);
  const [showApprove, setShowApprove] = useState(false);
  const [rejectType, setRejectType] = useState('');
  const [rejectNote, setRejectNote] = useState('');
  const [budgetItem, setBudgetItem] = useState('');
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from('invoice_status_history')
        .select('*, status:invoice_statuses(id, name)')
        .eq('invoice_id', invoice.id)
        .order('changed_at', { ascending: false });
      setHistory((data ?? []) as InvoiceStatusHistory[]);
    })();
  }, [invoice.id]);

  const transition = async (newStatusId: number, notes?: string) => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('invoices').update({ status_id: newStatusId, updated_at: new Date().toISOString() }).eq('id', invoice.id);
    await supabase.from('invoice_status_history').insert({ invoice_id: invoice.id, status_id: newStatusId, notes: notes ?? null, changed_by: user?.id ?? null });
    setSaving(false);
    onRefresh();
    onClose();
  };

  const handleReject = async () => {
    if (!rejectType || rejectNote.length < 30) return;
    await supabase.from('invoices').update({ rejection_reason: rejectNote, rejection_type: rejectType, updated_at: new Date().toISOString() }).eq('id', invoice.id);
    await transition(9, `${rejectType}: ${rejectNote}`);
  };

  const handleApprove = async () => {
    if (!budgetItem.trim()) return;
    await supabase.from('invoices').update({ budget_item: budgetItem, updated_at: new Date().toISOString() }).eq('id', invoice.id);
    await transition(15, `Aprobado. Partida presupuestaria: ${budgetItem}`);
  };

  const status = statuses.find(s => s.id === invoice.status_id);
  const isPendingApproval = invoice.status_id === 4 || invoice.status_id === 2;

  const row = (label: string, value: React.ReactNode) => (
    <div key={label}>
      <p className="text-xs text-green-600 dark:text-green-400 font-medium">{label}</p>
      <p className="text-sm text-gray-800 dark:text-slate-200">{value ?? '—'}</p>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-700 px-6 py-4 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">
              Detalles del comprobante {invoice.invoice_number}
            </h2>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              {(invoice.supplier as unknown as Supplier)?.legal_name ?? ''}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-slate-700 px-6">
          {(['info', 'history'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-green-500 text-green-600 dark:text-green-400' : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700'}`}
            >
              {t === 'info' ? 'Información' : 'Historial de estados'}
            </button>
          ))}
        </div>

        <div className="p-6">
          {tab === 'info' && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {row('Proveedor',           (invoice.supplier as unknown as Supplier)?.legal_name)}
                {row('Número de comprobante', invoice.invoice_number)}
                {row('Tipo de comprobante', INVOICE_TYPE_LABELS[invoice.invoice_type])}
                {row('Fecha de emisión',    fmtDate(invoice.issue_date))}
                {row('Fecha de vencimiento', fmtDate(invoice.due_date))}
                {row('Modalidad de pago',   invoice.payment_method ? PAYMENT_METHOD_LABELS[invoice.payment_method] : null)}
                {row('Fecha a pagar',       fmtDate(invoice.scheduled_payment_date))}
                {row('Sector',              invoice.sector)}
                {row('Estado',              status ? <StatusBadge statusId={status.id} statusName={status.name} /> : null)}
                {row('Monto gravado',       fmt(invoice.taxable_amount, invoice.currency))}
                {row('Impuestos',           fmt(invoice.tax_amount, invoice.currency))}
                {row('Monto retenciones',   fmt(invoice.retention_amount, invoice.currency))}
                {row('Monto cuota',         fmt(invoice.total_amount / invoice.installments, invoice.currency))}
                {row('Notas de crédito aplicadas', fmt(invoice.credit_notes_amount, invoice.currency))}
                {invoice.original_currency && invoice.original_currency !== invoice.currency && (
                  <>
                    {row('Cotización oficial',    invoice.exchange_rate_official ? `$${invoice.exchange_rate_official}` : null)}
                    {row('Cotización tarjeta',    invoice.exchange_rate_card ? `$${invoice.exchange_rate_card}` : null)}
                    {row('Monto original',        `${invoice.original_currency} ${invoice.original_amount}`)}
                  </>
                )}
                {row('Partida presupuestaria', invoice.budget_item)}
                {row('Fecha de imputación',  fmtDate(invoice.imputation_date))}
              </div>
              {invoice.rejection_reason && (
                <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-3">
                  <p className="text-xs font-medium text-red-600 dark:text-red-400">Motivo de rechazo: {invoice.rejection_type}</p>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">{invoice.rejection_reason}</p>
                </div>
              )}
            </div>
          )}

          {tab === 'history' && (
            <div className="space-y-2">
              {history.length === 0 && <p className="text-sm text-gray-400">Sin historial aún</p>}
              {history.map(h => {
                const s = statuses.find(st => st.id === h.status_id);
                return (
                  <div key={h.id} className="flex gap-3 text-sm">
                    <div className="flex flex-col items-center">
                      <div className="h-2 w-2 rounded-full bg-green-500 mt-1.5" />
                      <div className="flex-1 w-px bg-gray-200 dark:bg-slate-700 my-1" />
                    </div>
                    <div className="pb-3">
                      {s && <StatusBadge statusId={s.id} statusName={s.name} />}
                      <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{new Date(h.changed_at).toLocaleString('es-AR')}</p>
                      {h.notes && <p className="text-xs text-gray-600 dark:text-slate-300 mt-0.5">{h.notes}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Acciones de workflow */}
        {isPendingApproval && !showReject && !showApprove && (
          <div className="flex gap-2 px-6 pb-4">
            <button onClick={() => setShowReject(true)} className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
              <XCircle className="h-4 w-4" /> Rechazar
            </button>
            <button onClick={() => setShowApprove(true)} className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
              <CheckCircle className="h-4 w-4" /> Aprobar (Asignar presupuesto)
            </button>
          </div>
        )}

        {/* Formulario rechazo */}
        {showReject && (
          <div className="mx-6 mb-4 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-red-700 dark:text-red-400">Motivo de rechazo</h3>
            <select value={rejectType} onChange={e => setRejectType(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
              <option value="">Seleccione la tipificación</option>
              {REJECTION_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
            <textarea value={rejectNote} onChange={e => setRejectNote(e.target.value)} rows={4}
              placeholder="Describí el motivo (mínimo 30 caracteres)..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
            <p className="text-xs text-gray-500">Te quedan {500 - rejectNote.length} caracteres. (Mínimo: 30)</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowReject(false)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-slate-600">Cancelar</button>
              <button onClick={handleReject} disabled={saving || !rejectType || rejectNote.length < 30}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-60">
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Confirmar rechazo
              </button>
            </div>
          </div>
        )}

        {/* Formulario aprobación */}
        {showApprove && (
          <div className="mx-6 mb-4 rounded-xl border border-green-200 dark:border-green-900/40 bg-green-50 dark:bg-green-950/20 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-green-700 dark:text-green-400">Asignar presupuesto</h3>
            <input value={budgetItem} onChange={e => setBudgetItem(e.target.value)}
              placeholder="Ej: Plantas ornamentales - Compras Q2"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowApprove(false)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-slate-600">Cancelar</button>
              <button onClick={handleApprove} disabled={saving || !budgetItem.trim()}
                className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700 disabled:opacity-60">
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Aprobar
              </button>
            </div>
          </div>
        )}

        <div className="flex justify-end px-6 py-3 border-t border-gray-200 dark:border-slate-700">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-800">Cerrar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Nueva Factura ───────────────────────────────────────
interface InvoiceFormModalProps {
  statuses:        InvoiceStatus[];
  preSupplier?:    { id: string; name: string } | null;
  onClose:         () => void;
  onSaved:         () => void;
}

function InvoiceFormModal({ statuses: _statuses, preSupplier, onClose, onSaved }: InvoiceFormModalProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [form, setForm] = useState({
    supplier_id:    preSupplier?.id  ?? '',
    invoice_type:   'factura' as InvoiceType,
    invoice_number: '',
    issue_date:     '',
    due_date:       '',
    currency:       'ARS' as Currency,
    total_amount:   '',
    taxable_amount: '',
    tax_amount:     '',
    payment_method: '' as PaymentMethod | '',
    installments:   '1',
    sector:         '',
    original_amount:   '',
    original_currency: '',
    exchange_rate_official: '',
    exchange_rate_card:     '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  useEffect(() => {
    void supabase.from('suppliers').select('id, legal_name, fantasy_name').order('legal_name').then(({ data }) => setSuppliers((data ?? []) as Supplier[]));
  }, []);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.supplier_id) { setError('Seleccioná un proveedor.'); return; }
    if (!form.invoice_number.trim()) { setError('Ingresá el número de comprobante.'); return; }
    setSaving(true); setError('');
    const { data: { user } } = await supabase.auth.getUser();
    const { data: inv, error: err } = await supabase.from('invoices').insert({
      supplier_id:    form.supplier_id,
      invoice_type:   form.invoice_type,
      invoice_number: form.invoice_number.trim(),
      issue_date:     form.issue_date || null,
      due_date:       form.due_date   || null,
      currency:       form.currency,
      total_amount:   parseFloat(form.total_amount)   || 0,
      taxable_amount: parseFloat(form.taxable_amount) || null,
      tax_amount:     parseFloat(form.tax_amount)     || null,
      payment_method: form.payment_method || null,
      installments:   parseInt(form.installments) || 1,
      sector:         form.sector || null,
      original_amount:   parseFloat(form.original_amount)   || null,
      original_currency: form.original_currency || null,
      exchange_rate_official: parseFloat(form.exchange_rate_official) || null,
      exchange_rate_card:     parseFloat(form.exchange_rate_card)     || null,
      status_id: 1,
      created_by: user?.id ?? null,
    }).select().single();

    if (err || !inv) { setError(err?.message ?? 'Error al guardar'); setSaving(false); return; }

    // Crear cuotas si hay más de 1
    const numInstallments = parseInt(form.installments) || 1;
    if (numInstallments > 1) {
      const installmentAmount = (parseFloat(form.total_amount) || 0) / numInstallments;
      const issueDate = form.issue_date ? new Date(form.issue_date) : new Date();
      const installmentRows = Array.from({ length: numInstallments }, (_, i) => {
        const dueDate = new Date(issueDate);
        dueDate.setMonth(dueDate.getMonth() + i + 1);
        return {
          invoice_id: (inv as Invoice).id,
          installment_number: i + 1,
          amount: installmentAmount,
          due_date: dueDate.toISOString().split('T')[0],
          status_id: 1,
        };
      });
      await supabase.from('invoice_installments').insert(installmentRows);
    }

    // Registrar estado inicial
    await supabase.from('invoice_status_history').insert({ invoice_id: (inv as Invoice).id, status_id: 1, notes: 'Factura creada', changed_by: user?.id ?? null });
    onSaved();
  };

  const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-green-500';
  const labelCls = 'text-xs font-medium text-gray-600 dark:text-slate-400';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-700 px-6 py-4 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Cargar comprobante</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Tipo de comprobante *</label>
              <select value={form.invoice_type} onChange={e => set('invoice_type', e.target.value)} className={inputCls}>
                {Object.entries(INVOICE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Proveedor *</label>
              {preSupplier ? (
                <input readOnly value={preSupplier.name} className={`${inputCls} bg-gray-50 dark:bg-slate-700`} />
              ) : (
                <select value={form.supplier_id} onChange={e => set('supplier_id', e.target.value)} className={inputCls} required>
                  <option value="">Seleccioná un proveedor</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.legal_name}</option>)}
                </select>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Número de comprobante *</label>
              <input required value={form.invoice_number} onChange={e => set('invoice_number', e.target.value)} className={inputCls} placeholder="Ej: FC-0001-00001234" />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Sector que aprueba</label>
              <input value={form.sector} onChange={e => set('sector', e.target.value)} className={inputCls} placeholder="Ej: Operaciones" />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Fecha de emisión</label>
              <input type="date" value={form.issue_date} onChange={e => set('issue_date', e.target.value)} className={inputCls} />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Fecha de vencimiento</label>
              <input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} className={inputCls} />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Modalidad de pago</label>
              <select value={form.payment_method} onChange={e => set('payment_method', e.target.value)} className={inputCls}>
                <option value="">Seleccioná la modalidad</option>
                {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Cantidad de pagos (cuotas)</label>
              <select value={form.installments} onChange={e => set('installments', e.target.value)} className={inputCls}>
                {Array.from({ length: 24 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n} cuota{n > 1 ? 's' : ''}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Moneda</label>
              <select value={form.currency} onChange={e => set('currency', e.target.value)} className={inputCls}>
                {Object.entries(CURRENCY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Monto total</label>
              <input type="number" min="0" step="0.01" value={form.total_amount} onChange={e => set('total_amount', e.target.value)} className={inputCls} placeholder="0.00" />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Monto gravado (neto)</label>
              <input type="number" min="0" step="0.01" value={form.taxable_amount} onChange={e => set('taxable_amount', e.target.value)} className={inputCls} placeholder="0.00" />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Impuestos</label>
              <input type="number" min="0" step="0.01" value={form.tax_amount} onChange={e => set('tax_amount', e.target.value)} className={inputCls} placeholder="0.00" />
            </div>
            {form.currency !== 'ARS' && (
              <>
                <div className="flex flex-col gap-1">
                  <label className={labelCls}>Monto original ({form.currency})</label>
                  <input type="number" min="0" step="0.01" value={form.original_amount} onChange={e => set('original_amount', e.target.value)} className={inputCls} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className={labelCls}>Cotización oficial</label>
                  <input type="number" min="0" step="0.0001" value={form.exchange_rate_official} onChange={e => set('exchange_rate_official', e.target.value)} className={inputCls} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className={labelCls}>Cotización tarjeta</label>
                  <input type="number" min="0" step="0.0001" value={form.exchange_rate_card} onChange={e => set('exchange_rate_card', e.target.value)} className={inputCls} />
                </div>
              </>
            )}
          </div>

          {/* Adjunto placeholder */}
          <div className="rounded-lg border border-dashed border-gray-300 dark:border-slate-600 p-4 text-center">
            <FileStack className="h-8 w-8 text-gray-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-xs text-gray-400 dark:text-slate-500">Adjuntar comprobante (integración con Google Drive próximamente)</p>
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-800">Cancelar</button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? 'Guardando...' : 'Crear comprobante'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Página Principal ──────────────────────────────────────────
function InvoicesContent() {
  const searchParams  = useSearchParams();
  const router        = useRouter();
  const preSupplier   = searchParams.get('supplierId')
    ? { id: searchParams.get('supplierId')!, name: decodeURIComponent(searchParams.get('supplierName') ?? '') }
    : null;

  const [invoices,  setInvoices]  = useState<Invoice[]>([]);
  const [statuses,  setStatuses]  = useState<InvoiceStatus[]>([]);
  const [total,     setTotal]     = useState(0);
  const [page,      setPage]      = useState(1);
  const [search,    setSearch]    = useState('');
  const [loading,   setLoading]   = useState(true);
  // Abre el formulario si viene de "Cargar factura" (proveedor o dashboard)
  const [showForm,  setShowForm]  = useState(
    (!!preSupplier && !!searchParams.get('supplierName')) || searchParams.get('nuevo') === '1'
  );
  const [detail,    setDetail]    = useState<Invoice | null>(null);
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const supplierFilter = searchParams.get('supplierId');

  useEffect(() => {
    void supabase.from('invoice_statuses').select('*').order('id').then(({ data }) => setStatuses((data ?? []) as InvoiceStatus[]));
  }, []);

  const load = useCallback(async (p: number, q: string) => {
    setLoading(true);
    const from = (p - 1) * PAGE_SIZE;
    const to   = from + PAGE_SIZE - 1;
    let query = supabase
      .from('invoices')
      .select('*, supplier:suppliers(id, legal_name, fantasy_name), status:invoice_statuses(id, name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);
    if (supplierFilter) query = query.eq('supplier_id', supplierFilter);
    if (q.trim()) query = query.ilike('invoice_number', `%${q}%`);
    const { data, count } = await query;
    setInvoices((data ?? []) as unknown as Invoice[]);
    setTotal(count ?? 0);
    setLoading(false);
  }, [supplierFilter]);

  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => { void load(page, search); }, 300);
  }, [page, search, load]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Facturas"
        description={
          <>
            {total} {total === 1 ? 'comprobante' : 'comprobantes'}
            {supplierFilter && (
              <> · filtrado por proveedor{' '}
                <button onClick={() => router.push('/invoices')} className="font-medium text-green-700 hover:underline dark:text-green-400">
                  quitar filtro
                </button>
              </>
            )}
          </>
        }
        actions={
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" /> Cargar comprobante
          </Button>
        }
      />

      <SearchInput
        value={search}
        onChange={(v) => { setSearch(v); setPage(1); }}
        placeholder="Buscar por número de comprobante"
      />

      {/* Tabla */}
      <Card flush>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-slate-800">
                {['Razón social', 'Nombre fantasía', 'Nro. Comprobante', 'Monto', 'Estado', 'Vencimiento', 'Fecha a pagar', 'Fecha de pago', ''].map(h => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {loading ? (
                <tr><td colSpan={9} className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin text-gray-400 mx-auto" /></td></tr>
              ) : invoices.length === 0 ? (
                <tr><td colSpan={9}>
                  <EmptyState
                    icon={Receipt}
                    title={search ? 'Sin resultados' : 'No hay comprobantes cargados'}
                    description={search ? 'Probá con otro número.' : 'Cargá la primera factura de un proveedor para seguir sus vencimientos y pagos.'}
                    action={!search && <Button onClick={() => setShowForm(true)}><Plus className="h-4 w-4" />Cargar comprobante</Button>}
                  />
                </td></tr>
              ) : invoices.map(inv => {
                const s = Array.isArray(inv.supplier) ? inv.supplier[0] : inv.supplier;
                const st = statuses.find(x => x.id === inv.status_id);
                const isPending = inv.status_id === 4 || inv.status_id === 2;
                return (
                  <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                    <td className="px-3 py-3 font-medium text-gray-900 dark:text-slate-100 whitespace-nowrap">{(s as Supplier)?.legal_name ?? '—'}</td>
                    <td className="px-3 py-3 text-gray-600 dark:text-slate-400 whitespace-nowrap">{(s as Supplier)?.fantasy_name ?? '—'}</td>
                    <td className="px-3 py-3 text-gray-600 dark:text-slate-400 whitespace-nowrap">
                      {inv.invoice_number} {inv.installments > 1 ? `(1/${inv.installments})` : '(1/1)'}
                    </td>
                    <td className="px-3 py-3 text-gray-800 dark:text-slate-200 whitespace-nowrap font-medium">{fmt(inv.total_amount, inv.currency)}</td>
                    <td className="px-3 py-3">{st ? <StatusBadge statusId={st.id} statusName={st.name} /> : '—'}</td>
                    <td className="px-3 py-3 text-gray-600 dark:text-slate-400 whitespace-nowrap">{fmtDate(inv.due_date)}</td>
                    <td className="px-3 py-3 text-gray-600 dark:text-slate-400 whitespace-nowrap">{fmtDate(inv.scheduled_payment_date)}</td>
                    <td className="px-3 py-3 text-gray-600 dark:text-slate-400 whitespace-nowrap">{fmtDate(inv.payment_date)}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setDetail(inv)} title="Información" className="rounded p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700"><Info className="h-4 w-4" /></button>
                        <button title="Comprobantes adjuntos" className="rounded p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700"><FileStack className="h-4 w-4" /></button>
                        {isPending && (
                          <>
                            <button onClick={() => setDetail(inv)} title="Rechazar" className="rounded p-1.5 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"><XCircle className="h-4 w-4" /></button>
                            <button onClick={() => setDetail(inv)} title="Aprobar" className="rounded p-1.5 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20"><CheckCircle className="h-4 w-4" /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} />
      </Card>

      {/* Modales */}
      {showForm && (
        <InvoiceFormModal
          statuses={statuses}
          preSupplier={preSupplier}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); void load(page, search); }}
        />
      )}
      {detail && (
        <InvoiceDetailModal
          invoice={detail}
          statuses={statuses}
          onClose={() => setDetail(null)}
          onRefresh={() => { void load(page, search); }}
        />
      )}
    </div>
  );
}

export default function InvoicesPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><span className="text-sm text-gray-400">Cargando...</span></div>}>
      <InvoicesContent />
    </Suspense>
  );
}
