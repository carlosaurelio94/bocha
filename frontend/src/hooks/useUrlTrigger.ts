'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * Ejecuta `onTrigger` cuando la URL trae `?<param>=1` (p. ej. desde Ctrl+K),
 * también si ya estabas en la página, y después limpia el parámetro.
 */
export function useUrlTrigger(param: string, basePath: string, onTrigger: () => void) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const active = searchParams.get(param) === '1';

  useEffect(() => {
    if (active) router.replace(basePath, { scroll: false });
  }, [active, basePath, router]);

  // Ajuste de estado durante el render (patrón recomendado por React para reaccionar a props)
  const [last, setLast] = useState(false);
  if (active !== last) {
    setLast(active);
    if (active) onTrigger();
  }
}
