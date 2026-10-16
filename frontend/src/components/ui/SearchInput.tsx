'use client';

import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchInputProps {
  value:        string;
  onChange:     (value: string) => void;
  placeholder?: string;
  className?:   string;
}

export function SearchInput({ value, onChange, placeholder = 'Buscar...', className }: SearchInputProps) {
  return (
    <div className={cn('relative w-full sm:max-w-xs', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="block w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-8 text-sm text-gray-900
                   placeholder:text-gray-400 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20
                   dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500
                   [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Limpiar búsqueda"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-slate-200"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
