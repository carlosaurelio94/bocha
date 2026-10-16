import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-gray-200/70 dark:bg-slate-800', className)} />;
}

/** Lista de filas falsas mientras carga una tabla/lista. */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <ul className="divide-y divide-gray-100 dark:divide-slate-800">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="flex items-center gap-4 px-5 py-4">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </li>
      ))}
    </ul>
  );
}
