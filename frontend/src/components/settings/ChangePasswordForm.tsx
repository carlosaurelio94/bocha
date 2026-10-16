'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { PasswordInput } from '@/components/ui/PasswordInput';

export const MIN_PASSWORD_LENGTH = 8;

/**
 * Cambio de la propia contraseña.
 * Verifica la contraseña actual antes de cambiarla: sin eso, cualquiera con
 * acceso a una sesión abierta (PC compartida) podía cambiarla y bloquear al dueño.
 */
export function ChangePasswordForm() {
  const [current, setCurrent] = useState('');
  const [next,    setNext]    = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<{ field: 'current' | 'next' | 'confirm'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (next.length < MIN_PASSWORD_LENGTH) {
      setError({ field: 'next', text: `Tiene que tener al menos ${MIN_PASSWORD_LENGTH} caracteres.` });
      return;
    }
    if (next === current) {
      setError({ field: 'next', text: 'Tiene que ser distinta de la actual.' });
      return;
    }
    if (next !== confirm) {
      setError({ field: 'confirm', text: 'Las contraseñas no coinciden.' });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        toast.error('Tu sesión expiró. Volvé a iniciar sesión.');
        return;
      }

      const { error: reauthError } = await supabase.auth.signInWithPassword({ email: user.email, password: current });
      if (reauthError) {
        setError({ field: 'current', text: 'La contraseña actual no es correcta.' });
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: next });
      if (updateError) {
        toast.error('No se pudo cambiar la contraseña. Probá de nuevo.');
        return;
      }

      toast.success('Contraseña actualizada');
      setCurrent(''); setNext(''); setConfirm('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex max-w-sm flex-col gap-4" noValidate>
      <PasswordInput
        label="Contraseña actual" required autoComplete="current-password"
        value={current} onChange={(e) => setCurrent(e.target.value)}
        error={error?.field === 'current' ? error.text : undefined}
      />
      <PasswordInput
        label="Nueva contraseña" required autoComplete="new-password"
        value={next} onChange={(e) => setNext(e.target.value)}
        hint={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres.`}
        error={error?.field === 'next' ? error.text : undefined}
      />
      <PasswordInput
        label="Repetir nueva contraseña" required autoComplete="new-password"
        value={confirm} onChange={(e) => setConfirm(e.target.value)}
        error={error?.field === 'confirm' ? error.text : undefined}
      />
      <Button type="submit" loading={saving} className="self-start" disabled={!current || !next || !confirm}>
        Cambiar contraseña
      </Button>
    </form>
  );
}
