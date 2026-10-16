import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { parsePlanLimit } from '@/lib/errors';

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase admin credentials');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

const USERNAME_RE   = /^[a-z0-9_]{3,32}$/;
const MIN_PASSWORD  = 8;

/** Lee el body JSON sin reventar con 500 si viene mal formado. */
async function readJson<T>(request: Request): Promise<T | null> {
  try {
    const body = await request.json();
    return body && typeof body === 'object' ? body as T : null;
  } catch {
    return null;
  }
}

interface AdminContext {
  userId:        string;
  companyId:     string;
  companySlug:   string;
}

// Verifica autenticación, rol admin EN LA EMPRESA ACTIVA, y devuelve esa empresa.
async function requireAdmin(): Promise<
  | { ok: true; ctx: AdminContext }
  | { ok: false; status: number; message: string }
> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401, message: 'No autenticado' };

  // Trae la membresía + empresa + rol del usuario en su empresa activa.
  const { data: profile } = await supabase
    .from('profiles')
    .select('current_company_id')
    .eq('id', user.id)
    .single();

  if (!profile?.current_company_id) {
    return { ok: false, status: 403, message: 'Sin empresa activa asignada' };
  }

  const { data: membership } = await supabase
    .from('user_companies')
    .select('role:roles(name), company:companies(slug)')
    .eq('user_id', user.id)
    .eq('company_id', profile.current_company_id)
    .single();

  type Row = { role: { name: string } | null; company: { slug: string } | null };
  const m = membership as unknown as Row | null;

  if (!m || m.role?.name !== 'administrador') {
    return { ok: false, status: 403, message: 'Sin permisos' };
  }

  return {
    ok: true,
    ctx: {
      userId:      user.id,
      companyId:   profile.current_company_id,
      companySlug: m.company?.slug ?? 'tenant',
    },
  };
}

// POST /api/admin/users — crear usuario en la empresa activa
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const body = await readJson<{ username?: unknown; password?: unknown; roleId?: unknown; displayName?: unknown }>(request);
  if (!body) return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  const username    = typeof body.username    === 'string' ? body.username    : '';
  const password    = typeof body.password    === 'string' ? body.password    : '';
  const roleId      = typeof body.roleId      === 'string' ? body.roleId      : '';
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';

  if (!username || !password || !roleId) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
  }

  const cleanUsername = username.trim().toLowerCase().replace(/\s+/g, '_');
  // Mismas reglas que el alta self-service: si no, el usuario no puede loguearse
  // o queda con una contraseña trivial.
  if (!USERNAME_RE.test(cleanUsername)) {
    return NextResponse.json({ error: 'Usuario inválido (3-32 caracteres: letras, números o _)' }, { status: 400 });
  }
  if (password.length < MIN_PASSWORD) {
    return NextResponse.json({ error: `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres` }, { status: 400 });
  }
  // Email interno por empresa — nunca se usa para login, solo para Supabase Auth
  const email = `${cleanUsername}@${auth.ctx.companySlug}.internal`;

  const admin = adminClient();

  // 1. Crear el usuario en Supabase Auth (el trigger crea el profile base)
  const { data: newUser, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError || !newUser.user) {
    return NextResponse.json({ error: createError?.message ?? 'Error al crear usuario' }, { status: 400 });
  }

  const userId = newUser.user.id;

  // 2. Completar el profile con username + display_name + empresa activa
  const { error: profileError } = await admin.from('profiles').upsert({
    id:                 userId,
    email,
    username:           cleanUsername,
    display_name:       displayName || cleanUsername,
    current_company_id: auth.ctx.companyId,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: 'Error al crear perfil' }, { status: 500 });
  }

  // 3. Asignar a la empresa del admin con el rol elegido
  const { error: linkError } = await admin.from('user_companies').insert({
    user_id:    userId,
    company_id: auth.ctx.companyId,
    role_id:    roleId,
  });

  if (linkError) {
    await admin.auth.admin.deleteUser(userId);
    const limit = parsePlanLimit(linkError);
    if (limit) return NextResponse.json({ error: limit.message }, { status: 409 });
    return NextResponse.json({ error: 'Error al asignar empresa/rol' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, userId, username: cleanUsername });
}

// PATCH /api/admin/users — resetear contraseña
export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const body = await readJson<{ userId?: unknown; newPassword?: unknown }>(request);
  if (!body) return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  const userId      = typeof body.userId      === 'string' ? body.userId      : '';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

  if (!userId || newPassword.length < MIN_PASSWORD) {
    return NextResponse.json({ error: `Contraseña inválida (mínimo ${MIN_PASSWORD} caracteres)` }, { status: 400 });
  }

  const admin = adminClient();

  // Verificar que el usuario pertenezca a la empresa del admin (no resetear users de otras empresas)
  const { data: belongs } = await admin
    .from('user_companies')
    .select('user_id')
    .eq('user_id', userId)
    .eq('company_id', auth.ctx.companyId)
    .maybeSingle();

  if (!belongs) {
    return NextResponse.json({ error: 'El usuario no pertenece a tu empresa' }, { status: 403 });
  }

  const { error } = await admin.auth.admin.updateUserById(userId, { password: newPassword });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/users?userId=xxx — quitar usuario de la empresa
// (no borra el auth.user para no perder acceso si pertenece a otras empresas)
export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'Falta userId' }, { status: 400 });

  // Un admin quitándose a sí mismo podía dejar la empresa sin administrador.
  if (userId === auth.ctx.userId) {
    return NextResponse.json({ error: 'No podés quitarte a vos mismo de la empresa' }, { status: 400 });
  }

  const admin = adminClient();

  // Quitar de esta empresa
  const { error: unlinkErr } = await admin
    .from('user_companies')
    .delete()
    .eq('user_id', userId)
    .eq('company_id', auth.ctx.companyId);

  if (unlinkErr) return NextResponse.json({ error: unlinkErr.message }, { status: 500 });

  // Si no pertenece a ninguna otra empresa → eliminar de auth
  const { count } = await admin
    .from('user_companies')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if ((count ?? 0) === 0) {
    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
