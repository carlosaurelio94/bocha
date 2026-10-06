'use client';

import { use } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { FileDown, FileText, Send, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';
import { getQuoteById } from '@/lib/quotes';
import { generateQuotePdf } from '@/lib/generateQuotePdf';
import { useCompany } from '@/context/CompanyContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useUpdateQuoteStatus } from '@/hooks/useQuotes';
import { Badge }      from '@/components/ui/Badge';
import { Button, LinkButton } from '@/components/ui/Button';
import { Card }       from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton }   from '@/components/ui/Skeleton';
import { formatDate, formatCurrency } from '@/lib/utils';
import type { Quote, QuoteStatus } from '@/types';

function DetailSkeleton() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-20 rounded-2xl" />
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}

/** Qué sugerimos hacer según el estado actual — así no hay que pensar el flujo. */
const NEXT_STEPS: Record<QuoteStatus, { text: string; actions: { to: QuoteStatus; label: string; icon: React.ElementType; variant: 'primary' | 'secondary' | 'danger' }[] }> = {
  draft: {
    text: '¿Ya se lo mandaste al cliente?',
    actions: [{ to: 'sent', label: 'Marcar como enviado', icon: Send, variant: 'primary' }],
  },
  sent: {
    text: '¿Qué respondió el cliente?',
    actions: [
      { to: 'approved', label: 'Lo aprobó',  icon: CheckCircle2, variant: 'primary' },
      { to: 'rejected', label: 'Lo rechazó', icon: XCircle,      variant: 'secondary' },
    ],
  },
  approved: {
    text: 'Presupuesto aprobado.',
    actions: [{ to: 'sent', label: 'Volver a "enviado"', icon: RotateCcw, variant: 'secondary' }],
  },
  rejected: {
    text: 'El cliente lo rechazó.',
    actions: [{ to: 'draft', label: 'Pasar a borrador', icon: RotateCcw, variant: 'secondary' }],
  },
};

function NextStep({ quote }: { quote: Quote }) {
  const update = useUpdateQuoteStatus();
  const step   = NEXT_STEPS[quote.status];
  const done   = quote.status === 'approved' || quote.status === 'rejected';

  return (
    <div className={done
      ? 'flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700/80 dark:bg-slate-900'
      : 'flex flex-col gap-3 rounded-2xl border border-green-200 bg-green-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-green-900/50 dark:bg-green-900/10'}>
      <p className="text-sm font-medium text-gray-800 dark:text-slate-200">{step.text}</p>
      <div className="flex flex-wrap gap-2">
        {step.actions.map(({ to, label, icon: Icon, variant }) => (
          <Button
            key={to}
            size="sm"
            variant={variant}
            loading={update.isPending && update.variables?.status === to}
            disabled={update.isPending}
            onClick={() => update.mutate({ id: quote.id, status: to })}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}

export default function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { current: company } = useCompany();
  const { hasPermission } = usePermissions();

  const { data: quote, isLoading, isError } = useQuery({
    queryKey: ['quotes', 'detail', id],
    queryFn:  () => getQuoteById(id),
  });

  if (isLoading) return <DetailSkeleton />;

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

  const number = `#${String(quote.quote_number).padStart(4, '0')}`;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader
        backHref="/quotes"
        title={<>Presupuesto {number} <Badge variant={quote.status} /></>}
        description={
          <>
            {quote.client
              ? <Link href={`/clients/${quote.client.id}`} className="font-medium text-green-700 hover:underline dark:text-green-400">{quote.client.name}</Link>
              : '—'}
            {' · '}{formatDate(quote.quote_date)}
          </>
        }
        actions={
          <Button onClick={() => generateQuotePdf(quote, company?.name)}>
            <FileDown className="h-4 w-4" />
            Descargar PDF
          </Button>
        }
      />

      {hasPermission('presupuestos', 'editar') && <NextStep quote={quote} />}

      {/* Ítems */}
      <Card flush title={`Ítems (${quote.item_count})`}>
        <table className="hidden min-w-full md:table">
          <thead>
            <tr className="border-b border-gray-100 text-xs font-medium text-gray-500 dark:border-slate-800 dark:text-slate-400">
              <th className="px-5 py-3 text-left">Producto o servicio</th>
              <th className="px-5 py-3 text-right">Cant.</th>
              <th className="px-5 py-3 text-right">Precio unit.</th>
              <th className="px-5 py-3 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
            {quote.items?.map((item) => (
              <tr key={item.id}>
                <td className="px-5 py-3.5 text-sm text-gray-900 dark:text-slate-100">{item.product}</td>
                <td className="px-5 py-3.5 text-right text-sm text-gray-600 dark:text-slate-300">{item.quantity}</td>
                <td className="px-5 py-3.5 text-right text-sm text-gray-600 dark:text-slate-300">{formatCurrency(item.unit_price, quote.currency)}</td>
                <td className="px-5 py-3.5 text-right text-sm font-semibold text-gray-900 dark:text-slate-100">{formatCurrency(item.total_price, quote.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <ul className="divide-y divide-gray-100 md:hidden dark:divide-slate-800">
          {quote.items?.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm text-gray-900 dark:text-slate-100">{item.product}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  {item.quantity} × {formatCurrency(item.unit_price, quote.currency)}
                </p>
              </div>
              <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">{formatCurrency(item.total_price, quote.currency)}</span>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/60 px-5 py-4 dark:border-slate-800 dark:bg-slate-800/40">
          <span className="text-sm text-gray-500 dark:text-slate-400">Total</span>
          <span className="text-2xl font-bold tracking-tight text-gray-900 dark:text-slate-100">{formatCurrency(quote.total_amount, quote.currency)}</span>
        </div>
      </Card>

      {/* Texto informativo */}
      {quote.information && (
        <Card title={`Información adicional · ${quote.information.name}`}>
          <p className="whitespace-pre-wrap text-sm text-gray-600 dark:text-slate-300">{quote.information.information}</p>
        </Card>
      )}
    </div>
  );
}
