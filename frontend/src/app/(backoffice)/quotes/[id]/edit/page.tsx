'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Lock } from 'lucide-react';
import { getQuoteById } from '@/lib/quotes';
import { useUpdateQuote } from '@/hooks/useQuotes';
import { usePermissions } from '@/hooks/usePermissions';
import { QuoteForm, type QuoteFormValues } from '@/components/quotes/QuoteForm';
import { EmptyState } from '@/components/ui/EmptyState';
import { LinkButton } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import type { Quote } from '@/types';

function toFormValues(quote: Quote): QuoteFormValues {
  return {
    client_id:      quote.client_id,
    information_id: quote.information_id ?? '',
    quote_number:   quote.quote_number,
    quote_date:     quote.quote_date,
    currency:       (['$', 'Bs', '€'].includes(quote.currency) ? quote.currency : '$') as QuoteFormValues['currency'],
    status:         quote.status,
    items: (quote.items ?? []).map((i) => ({
      product:     i.product,
      quantity:    Number(i.quantity),
      unit_price:  Number(i.unit_price),
      total_price: Number(i.total_price),
    })),
  };
}

export default function EditQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { hasPermission, loading: permLoading } = usePermissions();
  const update = useUpdateQuote();

  const { data: quote, isLoading, isError } = useQuery({
    queryKey: ['quotes', 'detail', id],
    queryFn:  () => getQuoteById(id),
  });

  if (isLoading || permLoading) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (!hasPermission('presupuestos', 'editar')) {
    return (
      <EmptyState
        icon={Lock}
        title="No tenés permiso para editar presupuestos"
        description="Pedile a un administrador que te dé acceso."
        action={<LinkButton variant="secondary" href={`/quotes/${id}`}>Volver al presupuesto</LinkButton>}
      />
    );
  }

  if (isError || !quote) {
    return (
      <EmptyState
        icon={FileText}
        title="No encontramos este presupuesto"
        description="Puede que haya sido eliminado."
        action={<LinkButton variant="secondary" href="/quotes">Volver a presupuestos</LinkButton>}
      />
    );
  }

  return (
    <QuoteForm
      // key: si cambian los datos del servidor, el formulario arranca de nuevo con ellos
      key={quote.updated_at ?? quote.id}
      mode="edit"
      backHref={`/quotes/${id}`}
      initialValues={toFormValues(quote)}
      saving={update.isPending}
      onSubmit={async (dto) => { await update.mutateAsync({ id, dto }); return id; }}
    />
  );
}
