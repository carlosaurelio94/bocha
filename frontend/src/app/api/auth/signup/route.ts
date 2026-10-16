import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { validateSignup } from '@/lib/signupValidation';

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase admin credentials');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

interface Body {
  companySlug:  string;
  companyName:  string;
  username:     string;
  password:     string;
  displayName?: string;
  email?:       string;   // opcional — si no, se genera @<slug>.internal
}


export async function POST(request: Request) {
  let body: Body;
  try { body = await request.json() as Body; }
  catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  // Campos que no son string (p. ej. números) se tratan como vacíos en vez de reventar con 500
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const companySlug = str(body.companySlug).trim().toLowerCase();
  const username    = str(body.username).trim().toLowerCase();
  const companyName = str(body.companyName).trim();
  const password    = str(body.password);
  // El plan NO lo elige el cliente: el alta self-service siempre es 'free'.
  const planSlug    = 'free';

  const errors = validateSignup({ companyName, companySlug, username, password });
  const firstError = Object.values(errors)[0];
  if (firstError) {
    return NextResponse.json({ error: firstError, fields: errors }, { status: 400 });
  }

  const admin = adminClient();

  // Verificar disponibilidad
  const [{ data: slugFree }, { data: userFree }] = await Promise.all([
    admin.rpc('is_company_slug_available', { p_slug: companySlug }),
    admin.rpc('is_username_available',     { p_username: username }),
  ]);

  if (slugFree === false) return NextResponse.json({ error: 'Esa dirección ya está en uso, probá con otra', fields: { companySlug: 'Ya está en uso.' } }, { status: 409 });
  if (userFree === false) return NextResponse.json({ error: 'Ese usuario ya está en uso', fields: { username: 'Ya está en uso, elegí otro.' } }, { status: 409 });

  const email = str(body.email).trim().toLowerCase() || `${username}@${companySlug}.internal`;

  // 1. Crear user en Supabase Auth
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr || !created.user) {
    return NextResponse.json({ error: createErr?.message ?? 'No se pudo crear el usuario' }, { status: 400 });
  }
  const userId = created.user.id;

  // 2. Iniciar sesión server-side con las creds recién creadas para poder
  //    llamar bootstrap_company autenticado como el nuevo user (la RPC
  //    requiere auth.uid() y RLS lo respeta).
  const { data: session, error: sessErr } = await admin.auth.signInWithPassword({ email, password });
  if (sessErr || !session.session) {
    await admin.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: 'No se pudo iniciar sesión' }, { status: 500 });
  }

  // 3. Llamar bootstrap_company autenticado como el nuevo user
  const userScoped = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${session.session.access_token}` } },
      auth:   { autoRefreshToken: false, persistSession: false },
    }
  );

  const { data: companyId, error: bootErr } = await userScoped.rpc('bootstrap_company', {
    p_slug:         companySlug,
    p_company_name: companyName,
    p_username:     username,
    p_display_name: str(body.displayName).trim() || username,
    p_plan_slug:    planSlug,
  });

  if (bootErr || !companyId) {
    await admin.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: bootErr?.message ?? 'No se pudo crear la empresa' }, { status: 500 });
  }

  // Cerrar la sesión que armamos del lado server (el cliente armará la suya con login normal).
  await userScoped.auth.signOut();

  return NextResponse.json({
    ok:        true,
    userId,
    companyId,
    username,
    companySlug,
    email,
  });
}
