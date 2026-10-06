'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal }  from '@/components/ui/Modal';
import { Input }  from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { useCreateClient, useUpdateClient } from '@/hooks/useClients';
import type { Client } from '@/types';

const clientSchema = z.object({
  name:          z.string().min(2, 'Mínimo 2 caracteres').max(120),
  address:       z.string().max(200).optional().or(z.literal('')),
  rif:           z.string().max(20).optional().or(z.literal('')),
  phone:         z.string().max(20).optional().or(z.literal('')),
  client_status: z.enum(['prospect', 'client']),
});

type ClientFormValues = z.infer<typeof clientSchema>;

interface ClientFormProps {
  open:    boolean;
  onClose: () => void;
  client?: Client | null;
  /** Se llama con el cliente guardado (p. ej. para seleccionarlo en otro form). */
  onSaved?: (client: Client) => void;
}

export function ClientForm({ open, onClose, client, onSaved }: ClientFormProps) {
  const isEditing      = !!client;
  const createMutation = useCreateClient();
  const updateMutation = useUpdateClient();
  const isPending      = createMutation.isPending || updateMutation.isPending;

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: { name: '', address: '', rif: '', phone: '', client_status: 'prospect' },
  });

  useEffect(() => {
    if (client) {
      reset({ name: client.name, address: client.address ?? '', rif: client.rif ?? '', phone: client.phone ?? '', client_status: client.client_status });
    } else {
      reset({ name: '', address: '', rif: '', phone: '', client_status: 'prospect' });
    }
  }, [client, reset, open]);

  const onSubmit = async (values: ClientFormValues) => {
    const dto = { ...values, address: values.address || undefined, rif: values.rif || undefined, phone: values.phone || undefined };
    try {
      const saved = isEditing && client
        ? await updateMutation.mutateAsync({ id: client.id, dto })
        : await createMutation.mutateAsync(dto);
      onSaved?.(saved);
      onClose();
    } catch {
      // El hook ya mostró el toast de error; dejamos el formulario abierto.
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? 'Editar cliente' : 'Nuevo cliente'}
      description={isEditing ? undefined : 'Solo el nombre es obligatorio; el resto lo podés completar después.'}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Input label="Nombre" required placeholder="Ej: Carlos García" error={errors.name?.message} {...register('name')} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="RIF" placeholder="J-12345678-9" error={errors.rif?.message} {...register('rif')} />
          <Input label="Teléfono" placeholder="+58 412 000 0000" error={errors.phone?.message} {...register('phone')} />
        </div>

        <Input label="Dirección" placeholder="Calle, ciudad, estado" error={errors.address?.message} {...register('address')} />

        <Select id="client_status" label="Estado" required error={errors.client_status?.message} {...register('client_status')}>
          <option value="prospect">Prospecto (todavía no compró)</option>
          <option value="client">Cliente</option>
        </Select>

        <div className="flex flex-col-reverse gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end dark:border-slate-800">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>Cancelar</Button>
          <Button type="submit" loading={isPending}>{isEditing ? 'Guardar cambios' : 'Crear cliente'}</Button>
        </div>
      </form>
    </Modal>
  );
}
