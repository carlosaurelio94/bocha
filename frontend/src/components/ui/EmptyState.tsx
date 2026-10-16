import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon:         React.ElementType;
  title:        string;
  description?: string;
  action?:      React.ReactNode;
  className?:   string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-50 dark:bg-green-900/20">
        <Icon className="h-6 w-6 text-green-600 dark:text-green-400" />
      </div>
      <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-gray-500 dark:text-slate-400">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
