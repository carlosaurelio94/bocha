'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Leaf } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { PRODUCT_NAME } from '@/lib/brand';

interface Branding { name: string; primary_color: string; logo_url: string | null }
const DEFAULT_BRAND: Branding = { name: PRODUCT_NAME, primary_color: '#16a34a', logo_url: null };

export default function LoginPage() {
  // useSearchParams requiere Suspense para SSR estático en Next 15
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 dark:bg-slate-950" />}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const search = useSearchParams();
  const slug   = search.get('company');

  const [brand,    setBrand]    = useState<Branding>(DEFAULT_BRAND);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    if (!slug) return;
    let cancel = false;
    void (async () => {
      const { data } = await supabase.rpc('get_company_branding', { p_slug: slug });
      const row = Array.isArray(data) ? data[0] : null;
      if (!cancel && row) {
        setBrand({
          name:          row.name          ?? DEFAULT_BRAND.name,
          primary_color: row.primary_color ?? DEFAULT_BRAND.primary_color,
          logo_url:      row.logo_url      ?? null,
        });
      }
    })();
    return () => { cancel = true; };
  }, [slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 1. Resolver username → email via RPC (accesible sin autenticar)
      const { data: emailData, error: rpcError } = await supabase
        .rpc('get_email_by_username', { p_username: username.trim().toLowerCase() });

      if (rpcError || !emailData) {
        setError('Usuario o contraseña incorrectos.');
        setLoading(false);
        return;
      }

      // 2. Autenticar con el email resuelto
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: emailData as string,
        password,
      });

      if (authError) {
        setError('Usuario o contraseña incorrectos.');
        setLoading(false);
        return;
      }

      // 3. Hard redirect para que el middleware vea la cookie de sesión
      window.location.href = '/dashboard';

    } catch {
      setError('Ocurrió un error inesperado. Intentá de nuevo.');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-slate-950">
      <div className="w-full max-w-sm">

        {/* Logo dinámico (slug ?company=… o default) */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl shadow-lg"
            style={{ backgroundColor: brand.primary_color }}
          >
            {brand.logo_url
              ? <img src={brand.logo_url} alt="" className="h-7 w-7 object-contain" />
              : <Leaf className="h-7 w-7 text-white" />}
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">{brand.name}</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400">Backoffice · Acceso privado</p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="mb-6 text-lg font-semibold text-gray-900 dark:text-slate-100">Iniciar sesión</h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Usuario"
              id="login-username"
              required
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="tu_usuario"
            />

            <PasswordInput
              label="Contraseña"
              id="login-password"
              required
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
            />

            {error && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </p>
            )}

            <Button type="submit" loading={loading} className="mt-2 w-full justify-center">
              Entrar
            </Button>

            <div className="flex flex-col gap-1 text-center">
              <Link href="/recuperar" className="text-sm text-gray-500 hover:text-green-600 dark:text-slate-400 dark:hover:text-green-400 transition-colors">
                ¿Olvidaste tu contraseña?
              </Link>
              <Link href="/register" className="text-sm text-gray-500 hover:text-green-600 dark:text-slate-400 dark:hover:text-green-400 transition-colors">
                ¿No tenés cuenta? Creá tu empresa
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
