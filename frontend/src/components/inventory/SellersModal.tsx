'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Modal }  from '@/components/ui/Modal';
import { Input }  from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { useCreateSeller, useSellers, useUpdateSeller } from '@/hooks/useInventory';
import { inventoryErrorMessage } from '@/lib/inventory';
import { cn } from '@/lib/utils';

interface SellersModalProps {
  open:     boolean;
  onClose:  () => void;
  canEdit:  boolean;
}

/**
 * Vendedores: no necesitan usuario en el sistema. Un vendedor que se fue se
 * desactiva (no se borra) para no perder sus ventas en las métricas.
 */
export function SellersModal({ open, onClose, canEdit }: SellersModalProps) {
  const { data: sellers, isLoading } = useSellers();
  const create = useCreateSeller();
  const update = useUpdateSeller();
  const [name, setName]   = useState('');
  const [error, setError] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) { setError('Escribí un nombre.'); return; }
    if (trimmed.length > 80) { setError('Máximo 80 caracteres.'); return; }
    setError('');
    try {
      await create.mutateAsync(trimmed);
      setName('');
    } catch (err) {
      setError(inventoryErrorMessage(err, 'No se pudo agregar el vendedor.'));
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Vendedores" description="Al registrar una venta elegís quién la hizo; así se arman las métricas por vendedor.">
      {canEdit && (
        <form onSubmit={handleAdd} noValidate className="mb-5 flex items-start gap-2">
          <div className="flex-1">
            <Input id="seller-name" aria-label="Nombre del vendedor" placeholder="Nombre del vendedor" value={name} onChange={(e) => setName(e.target.value)} error={error || undefined} />
          </div>
          <Button type="submit" loading={create.isPending}><Plus className="h-4 w-4" />Agregar</Button>
        </form>
      )}

      {isLoading ? (
        <p className="py-6 text-center text-sm text-gray-500">Cargando…</p>
      ) : !sellers || sellers.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500 dark:text-slate-400">Todavía no hay vendedores. Agregá el primero para poder registrar ventas.</p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-slate-800">
          {sellers.map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-2.5">
              <Avatar name={s.name} />
              <span className={cn('flex-1 text-sm font-medium', s.active ? 'text-gray-900 dark:text-slate-100' : 'text-gray-400 line-through dark:text-slate-500')}>
                {s.name}
              </span>
              {canEdit && (
                <Button
                  size="sm"
                  variant={s.active ? 'ghost' : 'secondary'}
                  disabled={update.isPending}
                  onClick={() => update.mutate({ id: s.id, changes: { active: !s.active } })}
                  aria-label={s.active ? `Desactivar a ${s.name}` : `Reactivar a ${s.name}`}
                >
                  {s.active ? 'Desactivar' : 'Reactivar'}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
