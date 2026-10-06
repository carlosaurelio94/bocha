'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  open:         boolean;
  onClose:      () => void;
  title:        string;
  description?: string;
  children:     React.ReactNode;
  size?:        'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
};

/**
 * En desktop es un diálogo centrado; en mobile sube desde abajo (bottom sheet)
 * para que los botones queden al alcance del pulgar.
 */
export function Modal({ open, onClose, title, description, children, size = 'md' }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) {
      // Foco en el primer campo para poder escribir sin tocar el mouse.
      const first = panelRef.current?.querySelector<HTMLElement>(
        'input:not([type=hidden]):not([disabled]), textarea, select'
      );
      first?.focus();
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-gray-950/50 backdrop-blur-[2px] sm:items-center sm:p-4"
      onMouseDown={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={cn(
          'animate-slide-up relative flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-2xl',
          'sm:rounded-2xl dark:bg-slate-900 dark:ring-1 dark:ring-slate-700',
          sizeClasses[size]
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-4 dark:border-slate-800">
          <div>
            <h2 id="modal-title" className="text-base font-semibold text-gray-900 dark:text-slate-100">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-gray-500 dark:text-slate-400">{description}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="-mr-2 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600
                       dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
