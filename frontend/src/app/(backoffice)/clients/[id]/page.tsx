'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Pencil, FileText, Phone, MapPin, Hash, Plus } from 'lucide-react';
import { getClientById } from '@/lib/clients';
import { getQuotes } from '@/lib/quotes';
import { usePermissions } from '@/hooks/usePermissions';
import { ClientForm } from '@/components/clients/ClientForm';
import { Avatar }     from '@/components/ui/Avatar';
import { Badge }      from '@/components/ui/Badge';
import { Button, LinkButton } from '@/components/ui/Button';
import { Card }       from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton }   from '@/components/ui/Skeleton';
import { formatDate, formatCurrency } from '@/lib/utils';

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-28 rounded-2xl" />
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { hasPermission } = usePermissions();
  const [editOpen, setEditOpen] = useState(false);

  const { data: client, isLoading, isError } = useQuery({
    queryKey: ['clients', 'detail', id],
    queryFn:  () => getClientById(id),
  });

  // Presupuestos del cliente — carga solo cuando tenemos el cliente
  const { data: quotesData } = useQuery({
    queryKey: ['quotes', 'byClient', id],
    queryFn:  () => getQuotes({ page: 1, pageSize: 100, clientId: id }),
    enabled:  !!client,
  });

  if (isLoading) return <DetailSkeleton />;

  if (isError || !client) {
    return (
      <EmptyState
        icon={FileText}
        title="No encontramos este cliente"
        description="Puede que haya sido eliminado."
        action={<LinkButton variant="secondary" href="/clients">Volver a clientes</LinkButton>}
      />
    );
  }

  const infoItems = [
    { icon: Phone,  label: 'Teléfono',  value: client.phone,   href: client.phone ? `tel:${client.phone.replace(/\s+/g, '')}` : null },
    { icon: Hash,   label: 'RIF',       value: client.rif,     href: null },
    { icon: MapPin, label: 'Dirección', value: client.address, href: null },
  ];

  const quotes      = quotesData?.data ?? [];
  const approvedSum = quotes.filter((q) => q.status === 'approved' && q.currency === '$').reduce((s, q) => s + q.total_amount, 0);
  const canCreateQuote = hasPermission('presupuestos', 'crear');

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        backHref="/clients"
        title={
          <>
            <Avatar name={client.name} className="h-10 w-10 text-sm" />
            <span className="min-w-0 break-words">{client.name}</span>
            <Badge variant={client.client_status} />
          </>
        }
        description={`Cliente desde el ${formatDate(client.created_at)}`}
        actions={
          <>
            {hasPermission('clientes', 'editar') && (
              <Button variant="secondary" onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4" />
                Editar
              </Button>
            )}
            {canCreateQuote && (
              <LinkButton href={`/quotes/new?cliente=${client.id}`}>
                <Plus className="h-4 w-4" />
                Nuevo presupuesto
              </LinkButton>
            )}
          </>
        }
      />

      {/* Datos del cliente */}
      <Card>
        <dl className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {infoItems.map(({ icon: Icon, label, value, href }) => (
            <div key={label} className="flex items-start gap-3">
              <span className="rounded-lg bg-gray-100 p-2 dark:bg-slate-800">
                <Icon className="h-4 w-4 text-gray-500 dark:text-slate-400" />
              </span>
              <div className="min-w-0">
                <dt className="text-xs text-gray-500 dark:text-slate-400">{label}</dt>
                <dd className="mt-0.5 break-words text-sm font-medium text-gray-900 dark:text-slate-100">
                  {value
                    ? href ? <a href={href} className="text-green-700 hover:underline dark:text-green-400">{value}</a> : value
                    : <span className="font-normal text-gray-400 dark:text-slate-500">Sin cargar</span>}
                </dd>
              </div>
            </div>
          ))}
        </dl>
      </Card>

      {/* Presupuestos del cliente */}
      <Card
        flush
        title={`Presupuestos (${quotesData?.total ?? 0})`}
        actions={approvedSum > 0 && (
          <span className="text-xs text-gray-500 dark:text-slate-400">
            Aprobado: <span className="font-semibold text-gray-900 dark:text-slate-100">{formatCurrency(approvedSum)}</span>
          </span>
        )}
      >
        {quotes.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Sin presupuestos todavía"
            description={`Armale el primero a ${client.name}.`}
            action={canCreateQuote && (
              <LinkButton href={`/quotes/new?cliente=${client.id}`}><Plus className="h-4 w-4" />Crear presupuesto</LinkButton>
            )}
          />
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-slate-800">
            {quotes.map((quote) => (
              <li key={quote.id}>
                <Link href={`/quotes/${quote.id}`} className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-gray-50 dark:hover:bg-slate-800/60">
                  <span className="font-mono text-sm text-gray-500 dark:text-slate-400">#{String(quote.quote_number).padStart(4, '0')}</span>
                  <span className="flex-1 text-sm text-gray-500 dark:text-slate-400">{formatDate(quote.quote_date)}</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">{formatCurrency(quote.total_amount, quote.currency)}</span>
                  <Badge variant={quote.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ClientForm open={editOpen} onClose={() => setEditOpen(false)} client={client} />
    </div>
  );
}
