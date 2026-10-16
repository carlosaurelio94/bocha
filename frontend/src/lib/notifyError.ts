'use client';

import { toast } from 'sonner';
import { parsePlanLimit } from './errors';

/**
 * Muestra un toast de error. Si es un límite del plan, el mensaje lo explica
 * y ofrece ir a "Plan y facturación".
 */
export function notifyError(error: unknown, fallback: string) {
  const limit = parsePlanLimit(error);
  if (limit) {
    toast.error(limit.message, {
      duration: 8000,
      action: { label: 'Ver planes', onClick: () => window.location.assign('/settings/billing') },
    });
    return;
  }
  toast.error(fallback);
}
