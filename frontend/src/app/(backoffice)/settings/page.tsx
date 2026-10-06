'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, FileText, KeyRound, Loader2, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  useQuoteInformation,
  useCreateQuoteInformation,
  useUpdateQuoteInformation,
  useDeleteQuoteInformation,
} from '@/hooks/useQuoteInformation';
import { Modal }  from '@/components/ui/Modal';
import { Input }  from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import type { QuoteInformation } from '@/types';

// ─── Schema ───────────────────────────────────────────────────────────────────
const infoSchema = z.object({
  name:        z.string().min(1, 'Requerido').max(80),
  information: z.string().min(1, 'Requerido').max(2000),
});
type InfoFormValues = z.infer<typeof infoSchema>;

// ─── Modal de creación/edición ────────────────────────────────────────────────
function InfoForm({
  open,
  onClose,
  preset,
}: {
  open:    boolean;
  onClose: () => void;
  preset:  QuoteInformation | null;
}) {
  const isEditing = !!preset;
  const createMut = useCreateQuoteInformation();
  const updateMut = useUpdateQuoteInformation();
  const isPending = createMut.isPending || updateMut.isPending;

  const { register, handleSubmit, reset, formState: { errors } } = useForm<InfoFormValues>({
    resolver: zodResolver(infoSchema),
    values: {
      name:        preset?.name        ?? '',
      information: preset?.information ?? '',
    },
  });

  const onSubmit = async (values: InfoFormValues) => {
    try {
      if (isEditing && preset) {
        await updateMut.mutateAsync({ id: preset.id, dto: values });
      } else {
        await createMut.mutateAsync(values);
      }
      reset();
      onClose();
    } catch {
      // El hook ya mostró el toast de error; dejamos el formulario abierto.
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? 'Editar preset' : 'Nuevo preset de texto'}
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Input
          label="Nombre del preset"
          required
          placeholder="Ej: Pago en bolívares, Pago USD efectivo..."
          error={errors.name?.message}
          {...register('name')}
        />

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700 dark:text-slate-300">
            Texto informativo <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={8}
            placeholder="Texto que aparecerá al pie del presupuesto PDF..."
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900
                       placeholder:text-gray-400 focus:border-green-500 focus:outline-none focus:ring-1
                       focus:ring-green-500 resize-y
                       dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-500"
            {...register('information')}
          />
          {errors.information && (
            <p className="text-xs text-red-600">{errors.information.message}</p>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-slate-700">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" loading={isPending}>
            {isEditing ? 'Guardar cambios' : 'Crear preset'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Modal de confirmación de eliminación ──────────────────────────────────────
function DeletePresetModal({
  preset,
  onClose,
}: {
  preset:  QuoteInformation | null;
  onClose: () => void;
}) {
  const deleteMut = useDeleteQuoteInformation();

  const handleDelete = async () => {
    if (!preset) return;
    try {
      await deleteMut.mutateAsync(preset.id);
      onClose();
    } catch {
      // El hook ya mostró el toast de error.
    }
  };

  return (
    <Modal open={!!preset} onClose={onClose} title="Eliminar preset" size="sm">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-gray-600 dark:text-slate-300">
          ¿Eliminár el preset{' '}
          <span className="font-semibold text-gray-900 dark:text-slate-100">&quot;{preset?.name}&quot;</span>?
        </p>
        <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-slate-700">
          <Button variant="secondary" onClick={onClose} disabled={deleteMut.isPending}>
            Cancelar
          </Button>
          <Button variant="danger" loading={deleteMut.isPending} onClick={handleDelete}>
            Eliminar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Cambio de contraseña ─────────────────────────────────────────────────────
function ChangePasswordSection() {
  const [current,  setCurrent]  = useState('');
  const [newPass,  setNewPass]  = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [showCur,  setShowCur]  = useState(false);
  const [showNew,  setShowNew]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [message,  setMessage]  = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass !== confirm) { setMessage({ type: 'error', text: 'Las contraseñas no coinciden.' }); return; }
    if (newPass.length < 6)  { setMessage({ type: 'error', text: 'La contraseña debe tener al menos 6 caracteres.' }); return; }
    setSaving(true); setMessage(null);
    const { error } = await supabase.auth.updateUser({ password: newPass });
    setSaving(false);
    if (error) { setMessage({ type: 'error', text: error.message }); return; }
    setMessage({ type: 'success', text: 'Contraseña actualizada correctamente.' });
    setCurrent(''); setNewPass(''); setConfirm('');
  };

  const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-green-500';

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-center gap-2 mb-4">
        <KeyRound className="h-5 w-5 text-green-600" />
        <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Cambiar contraseña</h2>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 max-w-sm">
        <div className="relative">
          <input type={showCur ? 'text' : 'password'} placeholder="Contraseña actual" value={current}
            onChange={e => setCurrent(e.target.value)} className={inputCls} />
          <button type="button" onClick={() => setShowCur(!showCur)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400">
            {showCur ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <div className="relative">
          <input type={showNew ? 'text' : 'password'} placeholder="Nueva contraseña (mín. 6 caracteres)" value={newPass}
            onChange={e => setNewPass(e.target.value)} className={inputCls} minLength={6} required />
          <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400">
            {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <input type="password" placeholder="Repetir nueva contraseña" value={confirm}
          onChange={e => setConfirm(e.target.value)} className={inputCls} required />
        {message && (
          <p className={`text-sm rounded-lg px-3 py-2 ${message.type === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'}`}>
            {message.text}
          </p>
        )}
        <button type="submit" disabled={saving}
          className="flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60 w-fit">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? 'Guardando...' : 'Cambiar contraseña'}
        </button>
      </form>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { data: presets, isLoading } = useQuoteInformation();
  const [formOpen, setFormOpen]         = useState(false);
  const [selected, setSelected]         = useState<QuoteInformation | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<QuoteInformation | null>(null);

  const openCreate = () => { setSelected(null); setFormOpen(true); };
  const openEdit   = (p: QuoteInformation) => { setSelected(p); setFormOpen(true); };

  return (
    <div className="flex flex-col gap-6 max-w-3xl">

      {/* ── Cambiar contraseña ── */}
      <ChangePasswordSection />

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Configuración</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
            Presets de texto informativo para presupuestos
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nuevo preset
        </Button>
      </div>

      {/* ── Lista de presets ── */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse rounded-xl border border-gray-200 bg-white p-5 h-24" />
          ))}
        </div>
      ) : presets?.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-gray-300 bg-white py-16 dark:border-slate-600 dark:bg-slate-800">
          <FileText className="h-10 w-10 text-gray-300 dark:text-slate-600" />
          <p className="text-sm text-gray-400 dark:text-slate-500">No hay presets todavía. ¡Creá el primero!</p>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nuevo preset
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {presets?.map((preset) => (
            <div key={preset.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-slate-100">{preset.name}</p>
                  <p className="mt-1 text-sm text-gray-500 line-clamp-2 whitespace-pre-wrap dark:text-slate-400">
                    {preset.information}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => openEdit(preset)}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors dark:hover:bg-slate-700 dark:hover:text-slate-200"
                    title="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(preset)}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors dark:hover:bg-red-900/30 dark:hover:text-red-400"
                    title="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modales */}
      <InfoForm open={formOpen} onClose={() => setFormOpen(false)} preset={selected} />
      <DeletePresetModal preset={deleteTarget} onClose={() => setDeleteTarget(null)} />
    </div>
  );
}
