'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, FileText, KeyRound } from 'lucide-react';
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
import { Card }   from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { ChangePasswordForm } from '@/components/settings/ChangePasswordForm';
import { usePermissions } from '@/hooks/usePermissions';
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
      title={isEditing ? 'Editar texto' : 'Nuevo texto para presupuestos'}
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Input
          label="Nombre corto"
          hint="Solo lo ves vos, para elegirlo rápido al armar el presupuesto."
          required
          placeholder="Ej: Pago en bolívares, Pago USD efectivo..."
          error={errors.name?.message}
          {...register('name')}
        />

        <div className="flex flex-col gap-1">
          <label htmlFor="info-text" className="text-sm font-medium text-gray-700 dark:text-slate-300">
            Texto que sale en el PDF <span className="text-red-500">*</span>
          </label>
          <textarea
            id="info-text"
            rows={8}
            maxLength={2000}
            placeholder="Texto que aparecerá al pie del presupuesto PDF..."
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900
                       placeholder:text-gray-400 focus:border-green-500 focus:outline-none focus:ring-2
                       focus:ring-green-500/20 resize-y
                       dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
            {...register('information')}
          />
          {errors.information && (
            <p className="text-xs text-red-600">{errors.information.message}</p>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end dark:border-slate-800">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" loading={isPending}>
            {isEditing ? 'Guardar cambios' : 'Guardar texto'}
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
    <Modal open={!!preset} onClose={onClose} title="Eliminar texto" size="sm">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-gray-600 dark:text-slate-300">
          ¿Eliminar el texto{' '}
          <span className="font-semibold text-gray-900 dark:text-slate-100">&quot;{preset?.name}&quot;</span>?
        </p>
        <p className="text-xs text-gray-500 dark:text-slate-400">Los presupuestos que ya lo usan no cambian.</p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={deleteMut.isPending}>
            Cancelar
          </Button>
          <Button variant="danger" loading={deleteMut.isPending} onClick={handleDelete}>
            Sí, eliminar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { data: presets, isLoading } = useQuoteInformation();
  const { hasPermission } = usePermissions();
  const [formOpen, setFormOpen]         = useState(false);
  const [selected, setSelected]         = useState<QuoteInformation | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<QuoteInformation | null>(null);

  const canEdit    = hasPermission('configuracion', 'editar');
  const openCreate = () => { setSelected(null); setFormOpen(true); };
  const openEdit   = (p: QuoteInformation) => { setSelected(p); setFormOpen(true); };

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader title="Configuración" description="Ajustes de tus presupuestos y de tu cuenta." />

      {/* ── Textos de presupuestos ── */}
      <Card
        flush
        title={
          <span className="flex flex-col">
            Textos al pie de los presupuestos
            <span className="text-xs font-normal text-gray-500 dark:text-slate-400">
              Condiciones, formas de pago o validez que elegís al armar un presupuesto.
            </span>
          </span>
        }
        actions={canEdit && presets && presets.length > 0 && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nuevo texto
          </Button>
        )}
      >
        {isLoading ? (
          <ListSkeleton rows={2} />
        ) : !presets || presets.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Todavía no tenés textos guardados"
            description='Por ejemplo: "Precios válidos por 15 días. Pago 50% al confirmar."'
            action={canEdit && <Button onClick={openCreate}><Plus className="h-4 w-4" />Crear el primero</Button>}
          />
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-slate-800">
            {presets.map((preset) => (
              <li key={preset.id} className="flex items-start justify-between gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900 dark:text-slate-100">{preset.name}</p>
                  <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-gray-500 dark:text-slate-400">
                    {preset.information}
                  </p>
                </div>
                {canEdit && (
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => openEdit(preset)}
                      aria-label={`Editar ${preset.name}`}
                      title="Editar"
                      className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(preset)}
                      aria-label={`Eliminar ${preset.name}`}
                      title="Eliminar"
                      className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ── Seguridad ── */}
      <Card title={<span className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-green-600" />Seguridad</span>}>
        <ChangePasswordForm />
      </Card>

      <InfoForm open={formOpen} onClose={() => setFormOpen(false)} preset={selected} />
      <DeletePresetModal preset={deleteTarget} onClose={() => setDeleteTarget(null)} />
    </div>
  );
}
