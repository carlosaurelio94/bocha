import { cn } from '@/lib/utils';
import { stockLevel } from '@/lib/inventory';
import type { Product } from '@/types/inventory';

const styles = {
  out: 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-400/10 dark:text-red-400 dark:ring-red-400/20',
  low: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-400/10 dark:text-amber-400 dark:ring-amber-400/20',
  ok:  'bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-400/10 dark:text-green-400 dark:ring-green-400/20',
};
const labels = { out: 'Sin stock', low: 'Comprar más', ok: 'OK' };

export function StockBadge({ product, className }: { product: Pick<Product, 'stock_current' | 'stock_min'>; className?: string }) {
  const level = stockLevel(product);
  return (
    <span className={cn(
      'inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
      styles[level], className,
    )}>
      {labels[level]}
    </span>
  );
}
