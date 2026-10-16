'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCompany, type Plan } from '@/context/CompanyContext';
import { CONTACT_EMAIL } from '@/lib/brand';
import { PageHeader } from '@/components/ui/PageHeader';

export default function BillingPage() {
  const { current: company, currentPlan, loading } = useCompany();
  const [plans,  setPlans]  = useState<Plan[]>([]);
  const [usage,  setUsage]  = useState<{ users: number; clients: number; quotes: number; invoices: number }>({
    users: 0, clients: 0, quotes: 0, invoices: 0,
  });

  useEffect(() => {
    if (!company) return;
    let cancelled = false;

    void (async () => {
      const [pls, u, c, q, i] = await Promise.all([
        supabase.from('plans').select('*').eq('is_public', true).order('sort_order'),
        supabase.from('user_companies').select('*', { count: 'exact', head: true }).eq('company_id', company.id),
        supabase.from('clients').select('*', { count: 'exact', head: true }).eq('deleted', false),
        supabase.from('quotes').select('*', { count: 'exact', head: true }).eq('deleted', false),
        supabase.from('invoices').select('*', { count: 'exact', head: true }),
      ]);
      if (cancelled) return;
      setPlans((pls.data as Plan[] | null) ?? []);
      setUsage({
        users:    u.count ?? 0,
        clients:  c.count ?? 0,
        quotes:   q.count ?? 0,
        invoices: i.count ?? 0,
      });
    })();

    return () => { cancelled = true; };
  }, [company]);

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="flex flex-col gap-6">

      <PageHeader title="Plan y facturación" description={`Suscripción de ${company?.name ?? 'tu empresa'}`} />

      {/* Plan actual */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-slate-300">Plan actual</h2>
        {currentPlan ? (
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">{currentPlan.name}</p>
              {currentPlan.description && (
                <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">{currentPlan.description}</p>
              )}
              <p className="mt-3 text-sm text-gray-600 dark:text-slate-400">
                {currentPlan.price_monthly_ars > 0
                  ? <>AR$ <span className="font-medium">{currentPlan.price_monthly_ars.toLocaleString('es-AR')}</span> / mes</>
                  : 'Gratuito'}
              </p>
            </div>
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
              activo
            </span>
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-slate-400">Sin plan asignado.</p>
        )}
      </section>

      {/* Uso vs límites */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-slate-300">Uso</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <UsageCard label="Usuarios"  used={usage.users}    limit={currentPlan?.max_users ?? null} />
          <UsageCard label="Clientes"  used={usage.clients}  limit={currentPlan?.max_clients ?? null} />
          <UsageCard label="Presupuestos" used={usage.quotes} limit={currentPlan?.max_quotes_per_month ?? null} />
          <UsageCard label="Facturas"  used={usage.invoices} limit={currentPlan?.max_invoices_per_month ?? null} />
        </div>
      </section>

      {/* Comparativa de planes */}
      <section>
        <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-slate-300">Planes disponibles</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          {plans.map((p) => {
            const isCurrent = p.id === currentPlan?.id;
            return (
              <div
                key={p.id}
                className={`rounded-xl border bg-white p-6 dark:bg-slate-900 ${
                  isCurrent
                    ? 'border-green-500 ring-2 ring-green-500/20'
                    : 'border-gray-200 dark:border-slate-700'
                }`}
              >
                <p className="text-lg font-semibold text-gray-900 dark:text-slate-100">{p.name}</p>
                {p.description && <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{p.description}</p>}
                <p className="mt-4 text-2xl font-bold text-gray-900 dark:text-slate-100">
                  {p.price_monthly_ars > 0
                    ? <>AR$ {p.price_monthly_ars.toLocaleString('es-AR')}<span className="text-sm font-normal text-gray-500">/mes</span></>
                    : 'Gratis'}
                </p>
                <ul className="mt-4 space-y-1.5 text-sm text-gray-600 dark:text-slate-400">
                  <Limit label={p.max_users}             unit="usuarios" />
                  <Limit label={p.max_clients}           unit="clientes" />
                  <Limit label={p.max_quotes_per_month}  unit="presupuestos / mes" />
                  <Limit label={p.max_invoices_per_month} unit="facturas / mes" />
                </ul>
                <button
                  disabled={isCurrent}
                  className={`mt-5 w-full rounded-lg px-4 py-2 text-sm font-medium ${
                    isCurrent
                      ? 'cursor-default bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-gray-900 text-white hover:bg-gray-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white'
                  }`}
                >
                  {isCurrent ? 'Tu plan' : 'Hablanos para cambiar'}
                </button>
              </div>
            );
          })}
        </div>
        <p className="mt-4 flex items-center gap-1.5 text-xs text-gray-400 dark:text-slate-500">
          Los upgrades hoy son manuales. Pronto:
          <a href={`mailto:${CONTACT_EMAIL}`} className="inline-flex items-center gap-0.5 underline">
            {CONTACT_EMAIL} <ExternalLink className="h-3 w-3" />
          </a>
        </p>
      </section>

    </div>
  );
}

function UsageCard({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const pct = limit ? Math.min(100, (used / limit) * 100) : 0;
  const overLimit = limit !== null && used >= limit;
  return (
    <div className="rounded-lg border border-gray-100 p-4 dark:border-slate-800">
      <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-bold text-gray-900 dark:text-slate-100">
        {used.toLocaleString('es-AR')}
        <span className="ml-1 text-sm font-normal text-gray-400">/ {limit ?? '∞'}</span>
      </p>
      {limit !== null && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-slate-800">
          <div
            className={`h-full rounded-full ${overLimit ? 'bg-red-500' : 'bg-green-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

function Limit({ label, unit }: { label: number | null; unit: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <Check className="h-3.5 w-3.5 text-green-500" />
      {label === null ? <>Ilimitados {unit}</> : <>Hasta {label.toLocaleString('es-AR')} {unit}</>}
    </li>
  );
}
