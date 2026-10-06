'use client';

import { cn } from '@/lib/utils';

interface FilterTabsProps<T extends string> {
  value:    T;
  onChange: (value: T) => void;
  options:  { value: T; label: string }[];
}

/** Filtro por estado con un solo click, en lugar de un <select>. */
export function FilterTabs<T extends string>({ value, onChange, options }: FilterTabsProps<T>) {
  return (
    <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 sm:pb-0">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
            value === opt.value
              ? 'bg-gray-900 text-white dark:bg-slate-100 dark:text-slate-900'
              : 'text-gray-600 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-800'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
