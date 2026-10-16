import { cn } from '@/lib/utils';

/** Iniciales del nombre en un círculo — ayuda a escanear listas rápido. */
export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return (
    <span className={cn(
      'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-semibold text-green-700 dark:bg-green-500/15 dark:text-green-400',
      className
    )}>
      {initials || '?'}
    </span>
  );
}
