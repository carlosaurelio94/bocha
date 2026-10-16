'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCreateQuote } from '@/hooks/useQuotes';
import { QuoteForm } from '@/components/quotes/QuoteForm';

function NewQuoteContent() {
  const searchParams   = useSearchParams();
  const createMutation = useCreateQuote();

  return (
    <QuoteForm
      mode="create"
      backHref="/quotes"
      // /quotes/new?cliente=<id> (desde la ficha del cliente) lo deja preseleccionado
      initialClientId={searchParams.get('cliente')}
      saving={createMutation.isPending}
      onSubmit={async (dto) => (await createMutation.mutateAsync(dto))?.id}
    />
  );
}

export default function NewQuotePage() {
  return (
    <Suspense fallback={null}>
      <NewQuoteContent />
    </Suspense>
  );
}
