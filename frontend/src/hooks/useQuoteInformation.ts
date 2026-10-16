'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  getQuoteInformationList,
  createQuoteInformation,
  updateQuoteInformation,
  deleteQuoteInformation,
} from '@/lib/quoteInformation';

export const infoKeys = {
  all:  ['quote_information'] as const,
  list: ['quote_information', 'list'] as const,
};

export function useQuoteInformation() {
  return useQuery({ queryKey: infoKeys.list, queryFn: getQuoteInformationList });
}

export function useCreateQuoteInformation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: { name: string; information: string }) => createQuoteInformation(dto),
    onSuccess: () => { qc.invalidateQueries({ queryKey: infoKeys.all }); toast.success('Texto creado'); },
    onError:   () => toast.error('No se pudo crear el texto'),
  });
}

export function useUpdateQuoteInformation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: { name?: string; information?: string } }) =>
      updateQuoteInformation(id, dto),
    onSuccess: () => { qc.invalidateQueries({ queryKey: infoKeys.all }); toast.success('Texto actualizado'); },
    onError:   () => toast.error('No se pudo actualizar el texto'),
  });
}

export function useDeleteQuoteInformation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteQuoteInformation(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: infoKeys.all }); toast.success('Texto eliminado'); },
    onError:   () => toast.error('No se pudo eliminar el texto'),
  });
}
