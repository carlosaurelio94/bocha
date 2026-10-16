'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Leaf, ArrowLeft, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { requestJson } from '@/lib/http';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import {
  MIN_PASSWORD, normalizeUsername, slugify, validateSignup,
  type SignupErrors, type SignupInput,
} from '@/lib/signupValidation';

export default function RegisterPage() {
  const [companyName, setCompanyName] = useState('');
  const [companySlug, setCompanySlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [username,    setUsername]    = useState('');
  const [password,    setPassword]    = useState('');
  const [displayName, setDisplayName] = useState('');
  const [errors,      setErrors]      = useState<SignupErrors>({});
  const [formError,   setFormError]   = useState('');
  const [loading,     setLoading]     = useState(false);
  const [done,        setDone]        = useState(false);

  // La dirección se genera sola desde el nombre hasta que el usuario la edita a mano
  const handleCompanyName = (v: string) => {
    setCompanyName(v);
    if (!slugTouched) setCompanySlug(slugify(v));
  };

  const clearError = (field: keyof SignupInput) =>
    setErrors((e) => (e[field] ? { ...e, [field]: undefined } : e));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const input: SignupInput = { companyName, companySlug, username, password };
    const found = validateSignup(input);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setLoading(true);
    const res = await requestJson<{ email: string }>('/api/auth/signup', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ...input, displayName }),
    }, 'No se pudo completar el registro.');

    if (!res.ok) {
      const fields = (res.body?.fields ?? {}) as SignupErrors;
      setErrors(fields);
      if (Object.keys(fields).length === 0) setFormError(res.error);
      setLoading(false);
      return;
    }

    // Auto-login con las credenciales recién creadas
    const { error: signErr } = await supabase.auth.signInWithPassword({ email: res.data.email, password });
    if (signErr) {
      // Crear funcionó, pero el login automático no — mandar al login manual.
      setDone(true); setLoading(false);
      return;
    }

    window.location.href = '/dashboard';
  };

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-slate-950">
        <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">¡Empresa creada!</h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">
            Entrá con el usuario <strong className="text-gray-900 dark:text-slate-100">{username}</strong> y tu contraseña.
          </p>
          <Link href={`/login?company=${companySlug}`} className="mt-4 inline-block rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
            Ir a iniciar sesión
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8 dark:bg-slate-950">
      <div className="w-full max-w-md">

        <div className="mb-6 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-600 shadow-lg">
            <Leaf className="h-7 w-7 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Creá tu backoffice</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400">Plan gratuito, sin tarjeta. Te lleva un minuto.</p>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>

            <Section step={1} title="Tu empresa">
              <Input
                label="Nombre de la empresa" id="reg-company" required autoFocus
                value={companyName} placeholder="Vivero Urbano"
                onChange={(e) => { handleCompanyName(e.target.value); clearError('companyName'); }}
                error={errors.companyName}
              />
              <Input
                label="Dirección de acceso" id="reg-slug" required
                value={companySlug} placeholder="vivero-urbano"
                onChange={(e) => {
                  setSlugTouched(true);
                  setCompanySlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 32));
                  clearError('companySlug');
                }}
                error={errors.companySlug}
                hint={companySlug
                  ? `Tu equipo va a entrar desde …/login?company=${companySlug}`
                  : 'Se completa sola a partir del nombre.'}
              />
            </Section>

            <Section step={2} title="Tu usuario (vas a ser el administrador)">
              <Input
                label="Tu nombre" id="reg-display" autoComplete="name"
                value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Carlos Rodríguez"
              />
              <Input
                label="Usuario para entrar" id="reg-username" required autoComplete="username"
                autoCapitalize="none" autoCorrect="off" spellCheck={false}
                value={username} placeholder="carlos"
                onChange={(e) => { setUsername(normalizeUsername(e.target.value)); clearError('username'); }}
                error={errors.username}
                hint="Minúsculas, números o guion bajo."
              />
              <PasswordInput
                label="Contraseña" id="reg-password" required autoComplete="new-password"
                value={password} placeholder="••••••••"
                onChange={(e) => { setPassword(e.target.value); clearError('password'); }}
                error={errors.password}
                hint={password.length > 0 && password.length < MIN_PASSWORD
                  ? `Te faltan ${MIN_PASSWORD - password.length} caracteres.`
                  : `Mínimo ${MIN_PASSWORD} caracteres.`}
              />
            </Section>

            {formError && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                {formError}
              </p>
            )}

            <Button type="submit" size="lg" loading={loading} className="w-full">
              {loading ? 'Creando tu empresa…' : 'Crear mi backoffice'}
            </Button>

            <Link href="/login" className="flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200">
              <ArrowLeft className="h-4 w-4" /> ¿Ya tenés cuenta? Iniciá sesión
            </Link>
          </form>
        </div>
      </div>
    </div>
  );
}

function Section({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-slate-100">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-600 text-[11px] font-bold text-white">{step}</span>
        {title}
      </legend>
      {children}
    </fieldset>
  );
}
