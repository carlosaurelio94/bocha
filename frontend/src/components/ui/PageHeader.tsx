'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface PageHeaderProps {
  title:        React.ReactNode;
  description?: React.ReactNode;
  /** Si se pasa, muestra una flecha para volver a esa ruta. */
  backHref?:    string;
  /** Botones a la derecha (en mobile bajan debajo del título). */
  actions?:     React.ReactNode;
}

export function PageHeader({ title, description, backHref, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        {backHref && (
          <Link
            href={backHref}
            aria-label="Volver"
            className="mt-0.5 rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700
                       dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
        )}
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-3 text-2xl font-bold tracking-tight text-gray-900 dark:text-slate-100">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
