import { cn } from '@/lib/utils';

const variants = {
  prospect: 'bg-amber-50  text-amber-700  ring-amber-600/20  dark:bg-amber-400/10  dark:text-amber-400  dark:ring-amber-400/20',
  client:   'bg-green-50  text-green-700  ring-green-600/20  dark:bg-green-400/10  dark:text-green-400  dark:ring-green-400/20',
  draft:    'bg-gray-50   text-gray-600   ring-gray-500/20   dark:bg-slate-400/10  dark:text-slate-300  dark:ring-slate-400/20',
  sent:     'bg-blue-50   text-blue-700   ring-blue-600/20   dark:bg-blue-400/10   dark:text-blue-400   dark:ring-blue-400/20',
  approved: 'bg-green-50  text-green-700  ring-green-600/20  dark:bg-green-400/10  dark:text-green-400  dark:ring-green-400/20',
  rejected: 'bg-red-50    text-red-700    ring-red-600/20    dark:bg-red-400/10    dark:text-red-400    dark:ring-red-400/20',
} as const;

const dots: Record<keyof typeof variants, string> = {
  prospect: 'bg-amber-500',
  client:   'bg-green-500',
  draft:    'bg-gray-400',
  sent:     'bg-blue-500',
  approved: 'bg-green-500',
  rejected: 'bg-red-500',
};

export const badgeLabels: Record<keyof typeof variants, string> = {
  prospect: 'Prospecto',
  client:   'Cliente',
  draft:    'Borrador',
  sent:     'Enviado',
  approved: 'Aprobado',
  rejected: 'Rechazado',
};

interface BadgeProps {
  variant: keyof typeof variants;
  className?: string;
}

export function Badge({ variant, className }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
      variants[variant],
      className
    )}>
      <span className={cn('h-1.5 w-1.5 rounded-full', dots[variant])} />
      {badgeLabels[variant]}
    </span>
  );
}
