'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Users, FileText, DollarSign, Clock, Download, FilePlus2, UserPlus,
  Receipt, ArrowRight, CheckCircle2, Circle, ChevronRight, Search,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/context/CompanyContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Button, LinkButton } from '@/components/ui/Button';
import { Badge }  from '@/components/ui/Badge';
import { Card }   from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton, ListSkeleton } from '@/components/ui/Skeleton';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import type { Module, Action } from '@/types/permissions';
import type { QuoteStatus } from '@/types';

interface DashboardMetrics {
  totalClients:     number;
  quotesThisMonth:  number;
  revenueThisMonth: number;
  pendingQuotes:    number;
  totalQuotes:      number;
  recentQuotes: {
    id: string; quote_number: number; quote_date: string;
    total_amount: number; currency: string; status: QuoteStatus;
    client: { name: string } | null;
  }[];
}

async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  const now        = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

  const [clientsRes, quotesMonthRes, pendingRes, recentRes, totalQuotesRes] = await Promise.all([
    supabase.from('clients').select('id', { count: 'exact', head: true }).eq('deleted', false),
    supabase.from('quotes').select('total_amount, currency').eq('deleted', false).gte('quote_date', monthStart).lte('quote_date', monthEnd),
    supabase.from('quotes').select('id', { count: 'exact', head: true }).eq('deleted', false).eq('status', 'sent'),
    supabase.from('quotes').select('id, quote_number, quote_date, total_amount, currency, status, client:clients(name)').eq('deleted', false).order('created_at', { ascending: false }).limit(6),
    supabase.from('quotes').select('id', { count: 'exact', head: true }).eq('deleted', false),
  ]);

  if (clientsRes.error)     throw clientsRes.error;
  if (quotesMonthRes.error) throw quotesMonthRes.error;
  if (pendingRes.error)     throw pendingRes.error;
  if (recentRes.error)      throw recentRes.error;
  if (totalQuotesRes.error) throw totalQuotesRes.error;

  const revenueThisMonth = (quotesMonthRes.data ?? [])
    .filter((q) => q.currency === '$')
    .reduce((sum, q) => sum + (q.total_amount ?? 0), 0);

  const recentQuotes: DashboardMetrics['recentQuotes'] = (recentRes.data ?? []).map((q) => ({
    id:           q.id,
    quote_number: q.quote_number,
    quote_date:   q.quote_date,
    total_amount: q.total_amount,
    currency:     q.currency,
    status:       q.status as QuoteStatus,
    client:       Array.isArray(q.client) ? (q.client[0] ?? null) : (q.client ?? null),
  }));

  return {
    totalClients:     clientsRes.count     ?? 0,
    quotesThisMonth:  quotesMonthRes.data?.length ?? 0,
    revenueThisMonth,
    pendingQuotes:    pendingRes.count     ?? 0,
    totalQuotes:      totalQuotesRes.count ?? 0,
    recentQuotes,
  };
}

async function exportMetricsToCSV() {
  const { data, error } = await supabase
    .from('quotes')
    .select('quote_number, quote_date, total_amount, currency, status, client:clients(name)')
    .eq('deleted', false)
    .order('quote_date', { ascending: false });

  if (error || !data) return;

  type ExportRow = { quote_number: number; quote_date: string; total_amount: number; currency: string; status: string; client: { name: string } | { name: string }[] | null };

  const headers = ['N°', 'Cliente', 'Fecha', 'Total', 'Moneda', 'Estado'];
  const rows    = (data as ExportRow[]).map((q) => {
    const clientName = Array.isArray(q.client) ? (q.client[0]?.name ?? '') : (q.client?.name ?? '');
    return [q.quote_number, clientName, q.quote_date, q.total_amount, q.currency, q.status];
  });
  const csv     = [headers, ...rows].map((row) => row.map((v) => `"${v}"`).join(',')).join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement('a'), { href: url, download: `presupuestos_${new Date().toISOString().slice(0, 10)}.csv` });
  link.click();
  URL.revokeObjectURL(url);
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

// ─── Acciones rápidas ─────────────────────────────────────────────────────────

interface QuickAction {
  href:   string;
  label:  string;
  desc:   string;
  icon:   React.ElementType;
  tone:   string;
  module: Module;
  action: Action;
}

const QUICK_ACTIONS: QuickAction[] = [
  { href: '/quotes/new',          label: 'Nuevo presupuesto', desc: 'Armalo en un minuto',     icon: FilePlus2, tone: 'bg-green-600 text-white',                                    module: 'presupuestos', action: 'crear' },
  { href: '/clients?nuevo=1',     label: 'Nuevo cliente',     desc: 'Cargá sus datos',         icon: UserPlus,  tone: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400',       module: 'clientes',     action: 'crear' },
  { href: '/invoices?nuevo=1',    label: 'Cargar factura',    desc: 'De un proveedor',         icon: Receipt,   tone: 'bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400', module: 'facturas',     action: 'crear' },
  { href: '/quotes?estado=sent',  label: 'Hacer seguimiento', desc: 'Presupuestos sin respuesta', icon: Clock, tone: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',  module: 'presupuestos', action: 'ver'   },
];

function QuickActions() {
  const { hasPermission } = usePermissions();
  const actions = QUICK_ACTIONS.filter((a) => hasPermission(a.module, a.action));
  if (actions.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {actions.map(({ href, label, desc, icon: Icon, tone }) => (
        <Link
          key={href}
          href={href}
          className="group flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all
                     hover:-translate-y-0.5 hover:border-green-300 hover:shadow-md
                     dark:border-slate-700/80 dark:bg-slate-900 dark:hover:border-green-700"
        >
          <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl', tone)}>
            <Icon className="h-5 w-5" />
          </span>
          <span>
            <span className="flex items-center gap-1 text-sm font-semibold text-gray-900 dark:text-slate-100">
              {label}
              <ArrowRight className="h-3.5 w-3.5 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
            </span>
            <span className="text-xs text-gray-500 dark:text-slate-400">{desc}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}

// ─── Métricas ─────────────────────────────────────────────────────────────────

function MetricCard({ icon: Icon, label, value, sub, href, color }: {
  icon: React.ElementType; label: string; value: string; sub?: string; href?: string; color: string;
}) {
  const content = (
    <>
      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4', color)} />
        <p className="text-sm text-gray-500 dark:text-slate-400">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-slate-100">{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">{sub}</p>}
    </>
  );
  const cls = 'block rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-700/80 dark:bg-slate-900';
  return href
    ? <Link href={href} className={cn(cls, 'transition-colors hover:border-gray-300 dark:hover:border-slate-600')}>{content}</Link>
    : <div className={cls}>{content}</div>;
}

// ─── Primeros pasos (solo cuando la cuenta está vacía) ───────────────────────

function GettingStarted({ hasClients, hasQuotes }: { hasClients: boolean; hasQuotes: boolean }) {
  const steps = [
    { done: true,       label: 'Crear tu cuenta',             href: null },
    { done: hasClients, label: 'Cargar tu primer cliente',    href: '/clients?nuevo=1' },
    { done: hasQuotes,  label: 'Armar tu primer presupuesto', href: '/quotes/new' },
    { done: false,      label: 'Personalizar los textos de tus presupuestos (opcional)', href: '/settings' },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <Card
      title="Primeros pasos"
      actions={<span className="text-xs text-gray-500 dark:text-slate-400">{doneCount} de {steps.length}</span>}
    >
      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-800">
        <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>
      <ol className="space-y-1">
        {steps.map((s) => {
          const inner = (
            <>
              {s.done
                ? <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
                : <Circle className="h-5 w-5 shrink-0 text-gray-300 dark:text-slate-600" />}
              <span className={cn('flex-1 text-sm', s.done ? 'text-gray-400 line-through dark:text-slate-500' : 'text-gray-800 dark:text-slate-200')}>
                {s.label}
              </span>
              {!s.done && s.href && <ChevronRight className="h-4 w-4 text-gray-400" />}
            </>
          );
          return (
            <li key={s.label}>
              {!s.done && s.href
                ? <Link href={s.href} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-gray-50 dark:hover:bg-slate-800">{inner}</Link>
                : <div className="flex items-center gap-3 px-2 py-2">{inner}</div>}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const now       = new Date();
  const monthRaw  = now.toLocaleDateString('es-VE', { month: 'long', year: 'numeric' });
  const monthName = monthRaw.charAt(0).toUpperCase() + monthRaw.slice(1);
  const { current: company } = useCompany();

  const { data: metrics, isLoading, isError } = useQuery({
    queryKey: ['dashboard', 'metrics'],
    queryFn:  fetchDashboardMetrics,
    staleTime: 2 * 60 * 1000,
  });

  const isNewAccount = !!metrics && (metrics.totalClients === 0 || metrics.totalQuotes === 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={greeting()}
        description={<>Resumen de <span className="font-medium text-gray-700 dark:text-slate-300">{company?.name ?? 'tu empresa'}</span> · {monthName}</>}
        actions={
          <Button variant="secondary" onClick={exportMetricsToCSV}>
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
        }
      />

      <QuickActions />

      {metrics && isNewAccount && (
        <GettingStarted hasClients={metrics.totalClients > 0} hasQuotes={metrics.totalQuotes > 0} />
      )}

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[116px] rounded-2xl" />)
        ) : isError ? (
          <div className="col-span-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 lg:col-span-4 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400">
            No pudimos cargar las métricas. Probá recargar la página.
          </div>
        ) : (
          <>
            <MetricCard icon={Users}      label="Clientes"            value={String(metrics!.totalClients)}             color="text-blue-500"   href="/clients" />
            <MetricCard icon={FileText}   label="Presupuestos del mes" value={String(metrics!.quotesThisMonth)}         color="text-green-500"  href="/quotes" />
            <MetricCard icon={DollarSign} label="Presupuestado del mes" value={formatCurrency(metrics!.revenueThisMonth)} color="text-purple-500" sub="Solo en USD ($)" />
            <MetricCard icon={Clock}      label="Esperando respuesta" value={String(metrics!.pendingQuotes)}            color="text-amber-500"  href="/quotes?estado=sent" sub={metrics!.pendingQuotes > 0 ? 'Tocá para hacer seguimiento' : 'Todo al día'} />
          </>
        )}
      </div>

      {/* Actividad reciente */}
      <Card
        flush
        title="Últimos presupuestos"
        actions={
          <Link href="/quotes" className="text-sm font-medium text-green-700 hover:underline dark:text-green-400">
            Ver todos
          </Link>
        }
      >
        {isLoading ? (
          <ListSkeleton rows={4} />
        ) : metrics?.recentQuotes.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Todavía no hay presupuestos"
            description="Cuando crees uno, lo vas a ver acá."
            action={<LinkButton href="/quotes/new"><FilePlus2 className="h-4 w-4" />Crear presupuesto</LinkButton>}
          />
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-slate-800">
            {metrics?.recentQuotes.map((q) => (
              <li key={q.id}>
                <Link href={`/quotes/${q.id}`} className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-gray-50 dark:hover:bg-slate-800/60">
                  <span className="hidden font-mono text-xs text-gray-400 sm:block dark:text-slate-500">
                    #{String(q.quote_number).padStart(4, '0')}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-slate-100">{q.client?.name ?? '—'}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">{formatDate(q.quote_date)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-4">
                    <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">{formatCurrency(q.total_amount, q.currency)}</span>
                    <Badge variant={q.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {metrics && !isNewAccount && (
        <p className="flex items-center justify-center gap-1.5 text-xs text-gray-400 dark:text-slate-500">
          <Search className="h-3.5 w-3.5" />
          Tip: apretá <kbd className="rounded border border-gray-300 px-1 font-sans dark:border-slate-600">Ctrl K</kbd> para buscar o crear cualquier cosa.
        </p>
      )}
    </div>
  );
}
