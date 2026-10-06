'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Building2, Plus, Eye, Upload, List,
  Loader2, X, Pencil,
  Phone, Mail, Bell, BellOff, Landmark,
  Trash2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Supplier, SupplierContact, SupplierBankAccount, SupplierWithDetails } from '@/types/suppliers';
import { useRouter } from 'next/navigation';
import { Button }      from '@/components/ui/Button';
import { Card }        from '@/components/ui/Card';
import { PageHeader }  from '@/components/ui/PageHeader';
import { SearchInput } from '@/components/ui/SearchInput';
import { Pagination }  from '@/components/ui/Pagination';
import { EmptyState }  from '@/components/ui/EmptyState';

const PAGE_SIZE = 10;

// ─── Formulario Proveedor ────────────────────────────────────
interface SupplierFormModalProps {
  supplier?: Supplier | null;
  onClose:   () => void;
  onSaved:   () => void;
}

function SupplierFormModal({ supplier, onClose, onSaved }: SupplierFormModalProps) {
  const isEdit = !!supplier;
  const [form, setForm] = useState({
    legal_name:   supplier?.legal_name   ?? '',
    fantasy_name: supplier?.fantasy_name ?? '',
    tax_id:       supplier?.tax_id       ?? '',
    category:     supplier?.category     ?? '',
    notes:        supplier?.notes        ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.legal_name.trim()) { setError('La razón social es requerida.'); return; }
    setSaving(true); setError('');
    const payload = {
      legal_name:   form.legal_name.trim(),
      fantasy_name: form.fantasy_name.trim() || null,
      tax_id:       form.tax_id.trim()       || null,
      category:     form.category.trim()     || null,
      notes:        form.notes.trim()        || null,
      updated_at:   new Date().toISOString(),
    };
    const q = isEdit
      ? supabase.from('suppliers').update(payload).eq('id', supplier!.id)
      : supabase.from('suppliers').insert(payload);
    const { error: err } = await q;
    if (err) { setError(err.message); setSaving(false); return; }
    onSaved();
  };

  const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-green-500';
  const labelCls = 'text-xs font-medium text-gray-600 dark:text-slate-400';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-700 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">
            {isEdit ? 'Editar proveedor' : 'Nuevo proveedor'}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className={labelCls}>Razón social *</label>
              <input required value={form.legal_name} onChange={e => set('legal_name', e.target.value)} className={inputCls} placeholder="Ej: Insumos S.A." />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Nombre de fantasía</label>
              <input value={form.fantasy_name} onChange={e => set('fantasy_name', e.target.value)} className={inputCls} placeholder="Ej: InsumosPro" />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>CUIT / VAT / Tax ID</label>
              <input value={form.tax_id} onChange={e => set('tax_id', e.target.value)} className={inputCls} placeholder="Ej: 30-71234567-8" />
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className={labelCls}>Categoría</label>
              <input value={form.category} onChange={e => set('category', e.target.value)} className={inputCls} placeholder="Ej: Plantas, Insumos, Servicios" />
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className={labelCls}>Notas</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} className={inputCls} />
            </div>
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-slate-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800">Cancelar</button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear proveedor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal Detalle Proveedor ────────────────────────────────
interface SupplierDetailModalProps {
  supplier: Supplier;
  onClose:  () => void;
  onLoadInvoice: (s: Supplier) => void;
}

function SupplierDetailModal({ supplier, onClose, onLoadInvoice }: SupplierDetailModalProps) {
  const [details,  setDetails]  = useState<SupplierWithDetails | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [newContact, setNewContact] = useState<Partial<SupplierContact> | null>(null);
  const [newCbu, setNewCbu] = useState<Partial<SupplierBankAccount> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [cRes, bRes] = await Promise.all([
      supabase.from('supplier_contacts').select('*').eq('supplier_id', supplier.id).order('created_at'),
      supabase.from('supplier_bank_accounts').select('*').eq('supplier_id', supplier.id).order('created_at'),
    ]);
    setDetails({
      ...supplier,
      contacts:      (cRes.data ?? []) as SupplierContact[],
      bank_accounts: (bRes.data ?? []) as SupplierBankAccount[],
    });
    setLoading(false);
  }, [supplier]);

  useEffect(() => { void load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const saveContact = async () => {
    if (!newContact) return;
    setSaving(true);
    await supabase.from('supplier_contacts').insert({ supplier_id: supplier.id, ...newContact });
    setNewContact(null); setSaving(false); void load();
  };

  const deleteContact = async (id: string) => {
    await supabase.from('supplier_contacts').delete().eq('id', id);
    void load();
  };

  const saveCbu = async () => {
    if (!newCbu?.account_number) return;
    setSaving(true);
    await supabase.from('supplier_bank_accounts').insert({ supplier_id: supplier.id, account_type: newCbu.account_type ?? 'CBU', ...newCbu });
    setNewCbu(null); setSaving(false); void load();
  };

  const deleteCbu = async (id: string) => {
    await supabase.from('supplier_bank_accounts').delete().eq('id', id);
    void load();
  };

  const inputCls = 'rounded-lg border border-gray-300 px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-green-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-700 px-6 py-4 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">
            Detalles del Proveedor &ldquo;{supplier.fantasy_name ?? supplier.legal_name}&rdquo;
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </div>

        <div className="p-6 space-y-6">
          {/* Info principal */}
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ['Razón social', supplier.legal_name],
              ['Nombre de fantasía', supplier.fantasy_name],
              ['CUIT / Tax ID', supplier.tax_id],
              ['Categoría', supplier.category],
            ].map(([label, value]) => value && (
              <div key={label}>
                <p className="text-xs text-green-600 dark:text-green-400 font-medium">{label}</p>
                <p className="text-sm text-gray-800 dark:text-slate-200">{value}</p>
              </div>
            ))}
          </div>

          {/* Cargar factura */}
          <button
            onClick={() => { onClose(); onLoadInvoice(supplier); }}
            className="flex items-center gap-2 rounded-lg border border-green-300 px-3 py-1.5 text-sm text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-900/20"
          >
            <Upload className="h-4 w-4" />
            Cargar factura de este proveedor
          </button>

          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
          ) : (
            <>
              {/* Cuentas bancarias */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 flex items-center gap-2"><Landmark className="h-4 w-4" /> Cuentas bancarias</h3>
                  {!newCbu && (
                    <button onClick={() => setNewCbu({ account_type: 'CBU' })} className="text-xs text-green-600 hover:underline flex items-center gap-1"><Plus className="h-3 w-3" /> Agregar CBU/cuenta</button>
                  )}
                </div>
                {details?.bank_accounts.map(ba => (
                  <div key={ba.id} className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-slate-800 px-3 py-2 mb-2 text-sm">
                    <span className="font-medium text-gray-700 dark:text-slate-300">{ba.account_type}: {ba.account_number}</span>
                    <div className="flex items-center gap-2">
                      {ba.bank_name && <span className="text-xs text-gray-500">{ba.bank_name}</span>}
                      <button onClick={() => deleteCbu(ba.id)} className="text-red-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                ))}
                {newCbu && (
                  <div className="rounded-lg border border-dashed border-green-300 dark:border-green-700 p-3 space-y-2">
                    <div className="flex gap-2">
                      <select value={newCbu.account_type} onChange={e => setNewCbu(c => ({ ...c, account_type: e.target.value }))} className={inputCls}>
                        {['CBU', 'CVU', 'CLABE', 'IBAN', 'Cuenta corriente'].map(t => <option key={t}>{t}</option>)}
                      </select>
                      <input placeholder="Número de cuenta" value={newCbu.account_number ?? ''} onChange={e => setNewCbu(c => ({ ...c, account_number: e.target.value }))} className={`${inputCls} flex-1`} />
                      <input placeholder="Banco" value={newCbu.bank_name ?? ''} onChange={e => setNewCbu(c => ({ ...c, bank_name: e.target.value }))} className={`${inputCls} flex-1`} />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setNewCbu(null)} className="text-xs text-gray-500 hover:underline">Cancelar</button>
                      <button onClick={saveCbu} disabled={saving} className="text-xs bg-green-600 text-white rounded px-2 py-1 hover:bg-green-700 disabled:opacity-60">Guardar</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Contactos */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Contactos</h3>
                  {!newContact && (
                    <button onClick={() => setNewContact({})} className="text-xs text-green-600 hover:underline flex items-center gap-1"><Plus className="h-3 w-3" /> Nuevo contacto</button>
                  )}
                </div>

                {details?.contacts.map(c => (
                  <div key={c.id} className="rounded-lg border border-gray-100 dark:border-slate-700 p-3 mb-2 grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-xs text-green-600 font-medium">Nombre</span><p className="text-gray-800 dark:text-slate-200">{c.name ?? '—'}</p></div>
                    <div><span className="text-xs text-green-600 font-medium">Cargo</span><p className="text-gray-800 dark:text-slate-200">{c.role ?? '—'}</p></div>
                    <div className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-gray-400" /><span className="text-gray-600 dark:text-slate-400">{c.email ?? '—'}</span></div>
                    <div className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-gray-400" /><span className="text-gray-600 dark:text-slate-400">{c.phone ?? '—'}</span></div>
                    <div className="flex items-center gap-1.5 col-span-2 justify-between">
                      <span className={`flex items-center gap-1 text-xs ${c.notify_payment ? 'text-green-600' : 'text-gray-400'}`}>
                        {c.notify_payment ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
                        Comunicar pago: {c.notify_payment ? 'Sí' : 'No'}
                      </span>
                      <button onClick={() => deleteContact(c.id)} className="text-red-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                ))}

                {newContact !== null && (
                  <div className="rounded-lg border border-dashed border-green-300 dark:border-green-700 p-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input placeholder="Nombre" value={newContact.name ?? ''} onChange={e => setNewContact(c => ({ ...c, name: e.target.value }))} className={inputCls} />
                      <input placeholder="Cargo" value={newContact.role ?? ''} onChange={e => setNewContact(c => ({ ...c, role: e.target.value }))} className={inputCls} />
                      <input placeholder="Email" type="email" value={newContact.email ?? ''} onChange={e => setNewContact(c => ({ ...c, email: e.target.value }))} className={inputCls} />
                      <input placeholder="Teléfono" value={newContact.phone ?? ''} onChange={e => setNewContact(c => ({ ...c, phone: e.target.value }))} className={inputCls} />
                    </div>
                    <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-slate-400 cursor-pointer">
                      <input type="checkbox" checked={newContact.notify_payment ?? false} onChange={e => setNewContact(c => ({ ...c, notify_payment: e.target.checked }))} className="rounded" />
                      Comunicar pagos a este contacto
                    </label>
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setNewContact(null)} className="text-xs text-gray-500 hover:underline">Cancelar</button>
                      <button onClick={saveContact} disabled={saving} className="text-xs bg-green-600 text-white rounded px-2 py-1 hover:bg-green-700 disabled:opacity-60">Guardar</button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end px-6 py-4 border-t border-gray-200 dark:border-slate-700">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-800">Cerrar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Página principal ────────────────────────────────────────
export default function SuppliersPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [total,     setTotal]     = useState(0);
  const [page,      setPage]      = useState(1);
  const [search,    setSearch]    = useState('');
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [editing,   setEditing]   = useState<Supplier | null>(null);
  const [detail,    setDetail]    = useState<Supplier | null>(null);
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (p: number, q: string) => {
    setLoading(true);
    const from = (p - 1) * PAGE_SIZE;
    const to   = from + PAGE_SIZE - 1;
    let query = supabase.from('suppliers').select('*', { count: 'exact' }).order('legal_name').range(from, to);
    if (q.trim()) query = query.ilike('legal_name', `%${q}%`);
    const { data, count } = await query;
    setSuppliers((data ?? []) as Supplier[]);
    setTotal(count ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => { void load(page, search); }, 300);
  }, [page, search, load]);

  const handleLoadInvoice = (supplier: Supplier) => {
    router.push(`/invoices?supplierId=${supplier.id}&supplierName=${encodeURIComponent(supplier.legal_name)}`);
  };

  const handleFilterInvoices = (supplier: Supplier) => {
    router.push(`/invoices?supplierId=${supplier.id}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Proveedores"
        description={`${total} ${total === 1 ? 'proveedor' : 'proveedores'}`}
        actions={
          <Button onClick={() => { setEditing(null); setShowForm(true); }}>
            <Plus className="h-4 w-4" /> Nuevo proveedor
          </Button>
        }
      />

      <SearchInput
        value={search}
        onChange={(v) => { setSearch(v); setPage(1); }}
        placeholder="Buscar por razón social"
      />

      {/* Tabla */}
      <Card flush>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-slate-800">
                {['Razón social', 'Nombre de fantasía', 'Categoría', 'CUIT/VAT', ''].map(h => (
                  <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {loading ? (
                <tr><td colSpan={5} className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin text-gray-400 mx-auto" /></td></tr>
              ) : suppliers.length === 0 ? (
                <tr><td colSpan={5}>
                  <EmptyState
                    icon={Building2}
                    title={search ? 'Sin resultados' : 'Todavía no cargaste proveedores'}
                    description={search ? 'Probá con otro nombre.' : 'Cargá a quién le comprás para registrar sus facturas y pagos.'}
                    action={!search && <Button onClick={() => { setEditing(null); setShowForm(true); }}><Plus className="h-4 w-4" />Agregar proveedor</Button>}
                  />
                </td></tr>
              ) : suppliers.map(s => (
                <tr key={s.id} onClick={() => setDetail(s)} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-slate-100">{s.legal_name}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-slate-400">{s.fantasy_name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-slate-400">{s.category ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-slate-400">{s.tax_id ?? '—'}</td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setDetail(s)} title="Ver detalle" className="rounded p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700"><Eye className="h-4 w-4" /></button>
                      <button onClick={() => { setEditing(s); setShowForm(true); }} title="Editar" className="rounded p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => handleLoadInvoice(s)} title="Cargar factura" className="rounded p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700"><Upload className="h-4 w-4" /></button>
                      <button onClick={() => handleFilterInvoices(s)} title="Ver facturas" className="rounded p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700"><List className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} />
      </Card>

      {/* Modales */}
      {showForm && (
        <SupplierFormModal
          supplier={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); void load(page, search); }}
        />
      )}
      {detail && (
        <SupplierDetailModal
          supplier={detail}
          onClose={() => setDetail(null)}
          onLoadInvoice={handleLoadInvoice}
        />
      )}
    </div>
  );
}
