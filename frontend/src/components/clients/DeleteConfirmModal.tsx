'use client';

import { Modal }  from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useDeleteClient } from '@/hooks/useClients';
import type { Client } from '@/types';

interface DeleteConfirmModalProps {
  open:    boolean;
  onClose: () => void;
  client:  Client | null;
}

export function DeleteConfirmModal({ open, onClose, client }: DeleteConfirmModalProps) {
  const deleteMutation = useDeleteClient();

  const handleDelete = async () => {
    if (!client) return;
    try {
      await deleteMutation.mutateAsync(client.id);
      onClose();
    } catch {
      // El hook ya mostró el toast de error.
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Eliminar cliente" size="sm">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-gray-600 dark:text-slate-300">
          ¿Estás seguro de que querés eliminar a{' '}
          <span className="font-semibold text-gray-900 dark:text-slate-100">{client?.name}</span>?
          Esta acción no se puede deshacer.
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={deleteMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="danger"
            loading={deleteMutation.isPending}
            onClick={handleDelete}
          >
            Sí, eliminar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
