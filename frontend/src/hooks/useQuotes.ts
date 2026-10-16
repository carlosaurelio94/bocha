'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { notifyError } from '@/lib/notifyError';
import { pgCode } from '@/lib/errors';
import { getQuotes, createQuote, updateQuote, updateQuoteStatus, deleteQuote, getNextQuoteNumber } from '@/lib/quotes';
import type { CreateQuoteDTO, QuoteStatus } from '@/types';

export const quoteKeys = {
  all:        ['quotes'] as const,
  list:       (params: object) => ['quotes', 'list', params] as const,
  detail:     (id: string)     => ['quotes', 'detail', id] as const,
  nextNumber: ['quotes', 'nextNumber'] as const,
};

interface UseQuotesParams {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
}

export function useQuotes(params: UseQuotesParams) {
  return useQuery({
    queryKey: quoteKeys.list(params),
    queryFn:  () => getQuotes(params),
    placeholderData: (prev) => prev,
  });
}

export function useNextQuoteNumber({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: quoteKeys.nextNumber,
    queryFn:  getNextQuoteNumber,
    staleTime: 0,
    enabled,
  });
}

export function useCreateQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateQuoteDTO) => createQuote(dto),
    onSuccess: (quote, dto) => {
      qc.invalidateQueries({ queryKey: quoteKeys.all });
      const renumbered = typeof quote?.quote_number === 'number' && quote.quote_number !== dto.quote_number;
      toast.success(renumbered
        ? `Presupuesto creado como #${String(quote.quote_number).padStart(4, '0')} (el #${String(dto.quote_number).padStart(4, '0')} ya estaba en uso)`
        : 'Presupuesto creado');
    },
    onError: (error) => notifyError(error, 'No se pudo crear el presupuesto'),
  });
}

export function useUpdateQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: CreateQuoteDTO }) => updateQuote(id, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: quoteKeys.all });
      toast.success('Presupuesto actualizado');
    },
    onError: (error) => notifyError(error, pgCode(error) === '23505'
      ? 'Ese número de presupuesto ya está en uso'
      : 'No se pudo guardar el presupuesto'),
  });
}

export function useUpdateQuoteStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: QuoteStatus }) => updateQuoteStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: quoteKeys.all });
      toast.success('Estado actualizado');
    },
    onError: (error) => notifyError(error, 'No se pudo actualizar el estado'),
  });
}

export function useDeleteQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteQuote(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: quoteKeys.all });
      toast.success('Presupuesto eliminado');
    },
    onError: (error) => notifyError(error, 'No se pudo eliminar el presupuesto'),
  });
}
