'use client';

import { useMemo, useState } from 'react';
import { BarChart3, ShoppingCart, DollarSign, Package, Clock, Trophy } from 'lucide-react';
import { useSalesMetrics } from '@/hooks/useInventory';
import { usePermissions } from '@/hooks/usePermissions';
import { LowStockAlert } from '@/components/inventory/LowStockAlert';
import { Card }       from '@/components/ui/Card';
import { Input }      from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterTabs } from '@/components/ui/FilterTabs';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton }   from '@/components/ui/Skeleton';
import { formatQty, presetRange, type RangePreset } from '@/lib/inventory';
import { cn, formatCurrency, formatDate } from '@/lib/utils';

type Preset = RangePreset | 'custom';

const PRESETS: { value: Preset; label: string }[] = [
  { value: 'month',      label: 'Este mes'    },
  { value: 'last_month', label: 'Mes pasado'  },
  { value: '7d',         label: '7 días'      },
  { value: '30d',        label: '30 días'     },
  { value: 'year',       label: 'Este año'    },
  { value: 'custom',     label: 'Elegir fechas' },
];

function Kpi({ icon: Icon, label, value, tone }: { icon: React.ElementType; label: string; value: string; tone: string }) {
  return (
    <Card>
      <div className="flex items-center gap-3">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', tone)}><Icon className="h-5 w-5" /></div>
        <div className="min-w-0">
          <p className="text-xs text-gray-500 dark:text-slate-400">{label}</p>
          <p className="truncate text-xl font-bold tabular-nums text-gray-900 dark:text-slate-100">{value}</p>
        </div>
      </div>
    </Card>
  );
}

function Bar({ value, max, className }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-slate-800">
      <div className={cn('h-full rounded-full', className ?? 'bg-green-500')} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function MetricsPage() {
  const { canView, loading: permLoading } = usePermissions();
  const [preset, setPreset] = useState<Preset>('month');
  const [custom, setCustom] = useState(() => presetRange('month'));

  const range = useMemo(() => (preset === 'custom' ? custom : presetRange(preset)), [preset, custom]);
  const validRange = !!range.from && !!range.to && range.from <= range.to;
  const allowed = canView('metricas');
  const { data, isLoading, isError } = useSalesMetrics(range.from, range.to, allowed && validRange);

  if (!permLoading && !allowed) {
    return <EmptyState icon={BarChart3} title="No tenés acceso a las métricas" description="Pedile a un administrador que te dé permiso." />;
  }

  const maxSeller  = Math.max(0, ...(data?.sellers.map((s) => s.revenue) ?? []));
  const maxProduct = Math.max(0, ...(data?.products.map((p) => p.units) ?? []));
  const maxDay     = Math.max(0, ...(data?.daily.map((d) => d.revenue) ?? []));
  const hasSales   = !!data && data.totals.sales > 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Métricas" description="Cuánto vendió cada vendedor y qué productos salen más" />

      <LowStockAlert />

      <div className="flex flex-col gap-3">
        <FilterTabs<Preset> value={preset} onChange={(p) => { if (p === 'custom') setCustom(range); setPreset(p); }} options={PRESETS} />
        {preset === 'custom' && (
          <div className="grid max-w-md grid-cols-2 gap-3">
            <Input id="metrics-from" label="Desde" type="date" value={custom.from} max={custom.to} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
            <Input id="metrics-to"   label="Hasta" type="date" value={custom.to} min={custom.from} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
              error={validRange ? undefined : 'La fecha final es anterior a la inicial.'} />
          </div>
        )}
        <p className="text-xs text-gray-500 dark:text-slate-400">Del {formatDate(range.from)} al {formatDate(range.to)}</p>
      </div>

      {isError ? (
        <p className="py-8 text-center text-sm text-red-500">No pudimos cargar las métricas. Recargá la página.</p>
      ) : isLoading || !data ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi icon={ShoppingCart} label="Ventas"           value={String(data.totals.sales)}          tone="bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400" />
            <Kpi icon={DollarSign}   label="Facturado"        value={formatCurrency(data.totals.revenue)} tone="bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400" />
            <Kpi icon={Package}      label="Unidades vendidas" value={formatQty(data.totals.units)}      tone="bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400" />
            <Kpi icon={Clock}        label="A cobrar"         value={formatCurrency(data.totals.pending)} tone="bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400" />
          </div>

          <Card title="Ventas por vendedor" flush>
            {data.sellers.length === 0 ? (
              <EmptyState icon={Trophy} title="Sin vendedores" description="Cargalos desde Ventas → Vendedores." />
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-slate-800">
                {data.sellers.map((s, i) => (
                  <li key={s.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:gap-4">
                    <div className="flex items-center gap-3 sm:w-48">
                      <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                        i === 0 && s.sales > 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' : 'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400')}>
                        {i + 1}
                      </span>
                      <span className="truncate text-sm font-medium text-gray-900 dark:text-slate-100">
                        {s.name}{!s.active && <span className="ml-1 text-xs font-normal text-gray-400">(inactivo)</span>}
                      </span>
                    </div>
                    <div className="flex-1"><Bar value={s.revenue} max={maxSeller} /></div>
                    <div className="grid grid-cols-3 gap-3 text-right text-xs text-gray-500 sm:w-80 dark:text-slate-400">
                      <span><span className="block text-sm font-semibold tabular-nums text-gray-900 dark:text-slate-100">{s.sales}</span>ventas</span>
                      <span><span className="block text-sm font-semibold tabular-nums text-gray-900 dark:text-slate-100">{formatQty(s.units)}</span>unidades</span>
                      <span><span className="block text-sm font-semibold tabular-nums text-gray-900 dark:text-slate-100">{formatCurrency(s.revenue)}</span>
                        {s.sales > 0 ? `prom. ${formatCurrency(s.revenue / s.sales)}` : 'facturado'}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {hasSales && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card title="Productos más vendidos" flush>
                <ul className="divide-y divide-gray-100 dark:divide-slate-800">
                  {data.products.map((p) => (
                    <li key={p.id} className="flex flex-col gap-1.5 px-5 py-3">
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="truncate font-medium text-gray-900 dark:text-slate-100">{p.name}</span>
                        <span className="shrink-0 tabular-nums text-gray-500 dark:text-slate-400">{formatQty(p.units)} {p.unit} · {formatCurrency(p.revenue)}</span>
                      </div>
                      <Bar value={p.units} max={maxProduct} className="bg-purple-500" />
                    </li>
                  ))}
                </ul>
              </Card>

              <Card title="Facturado por día">
                <div className="flex h-40 items-end gap-1" role="img" aria-label="Facturado por día">
                  {data.daily.map((d) => (
                    <div key={d.day} className="group relative flex h-full flex-1 items-end" title={`${formatDate(d.day)}: ${formatCurrency(d.revenue)} (${d.sales} ventas)`}>
                      <div className="w-full rounded-t bg-green-500/80 group-hover:bg-green-600" style={{ height: `${maxDay > 0 ? Math.max(3, (d.revenue / maxDay) * 100) : 0}%` }} />
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex justify-between text-xs text-gray-400">
                  <span>{formatDate(data.daily[0].day)}</span>
                  <span>{formatDate(data.daily[data.daily.length - 1].day)}</span>
                </div>
              </Card>
            </div>
          )}

          {!hasSales && (
            <Card>
              <EmptyState icon={BarChart3} title="Sin ventas en este período" description="Probá con otro rango de fechas o registrá ventas desde Ventas." />
            </Card>
          )}
        </>
      )}
    </div>
  );
}
