import { cn } from '@/lib/utils';
import type { SaleStatus } from '@/types/inventory';

export const saleStatusLabels: Record<SaleStatus, string> = { pending: 'A cuenta', paid: 'Pagada' };

export function SaleStatusBadge({ status }: { status: SaleStatus }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
      status === 'paid'
        ? 'bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-400/10 dark:text-green-400 dark:ring-green-400/20'
        : 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-400/10 dark:text-amber-400 dark:ring-amber-400/20',
    )}>
      <span className={cn('h-1.5 w-1.5 rounded-full', status === 'paid' ? 'bg-green-500' : 'bg-amber-500')} />
      {saleStatusLabels[status]}
    </span>
  );
}
