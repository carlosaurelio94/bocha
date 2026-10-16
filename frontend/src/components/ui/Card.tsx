import { cn } from '@/lib/utils';

interface CardProps {
  title?:     React.ReactNode;
  actions?:   React.ReactNode;
  className?: string;
  /** Sin padding interno: útil para tablas que van de borde a borde. */
  flush?:     boolean;
  children:   React.ReactNode;
}

export function Card({ title, actions, className, flush = false, children }: CardProps) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-slate-700/80 dark:bg-slate-900',
        className
      )}
    >
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-slate-800">
          {title && <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100">{title}</h2>}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={flush ? '' : 'p-5'}>{children}</div>
    </section>
  );
}
