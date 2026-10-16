'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { notifyError } from '@/lib/notifyError';
import { getClients, createClient, updateClient, deleteClient } from '@/lib/clients';
import type { CreateClientDTO, UpdateClientDTO } from '@/types';

export const clientKeys = {
  all:    ['clients'] as const,
  list:   (params: object) => ['clients', 'list', params] as const,
  detail: (id: string)     => ['clients', 'detail', id] as const,
};

interface UseClientsParams {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
}

export function useClients(params: UseClientsParams) {
  return useQuery({
    queryKey: clientKeys.list(params),
    queryFn:  () => getClients(params),
    placeholderData: (prev) => prev,
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateClientDTO) => createClient(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: clientKeys.all });
      toast.success('Cliente creado');
    },
    onError: (error) => notifyError(error, 'No se pudo crear el cliente'),
  });
}

export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateClientDTO }) => updateClient(id, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: clientKeys.all });
      toast.success('Cliente actualizado');
    },
    onError: (error) => notifyError(error, 'No se pudo actualizar el cliente'),
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteClient(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: clientKeys.all });
      toast.success('Cliente eliminado');
    },
    onError: (error) => notifyError(error, 'No se pudo eliminar el cliente'),
  });
}
