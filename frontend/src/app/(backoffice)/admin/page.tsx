'use client';

import { useEffect, useState, useCallback } from 'react';
import { ShieldCheck, Plus, X, Loader2, ChevronDown, UserPlus, Eye, EyeOff, KeyRound } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { usePermissions } from '@/hooks/usePermissions';
import type { Role, UserWithRoles } from '@/types/permissions';
import { toast } from 'sonner';
import { requestJson } from '@/lib/http';

// ─── tipos crudos de Supabase ──────────────────────────────
interface ProfileRow {
  id:           string;
  email:        string;
  username:     string | null;
  display_name: string | null;
  user_roles: {
    role: { id: string; name: string; description: string | null };
  }[];
}

const ROLE_COLORS: Record<string, string> = {
  administrador:        'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  usuario_clientes:     'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  usuario_presupuestos: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  viewer:               'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300',
};

// ─── Formulario crear usuario ──────────────────────────────
interface CreateUserFormProps {
  roles: Role[];
  onCreated: () => void;
}

function CreateUserForm({ roles, onCreated }: CreateUserFormProps) {
  const [open,        setOpen]        = useState(false);
  const [username,    setUsername]    = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password,    setPassword]    = useState('');
  const [showPass,    setShowPass]    = useState(false);
  const [roleId,      setRoleId]      = useState('');
  const [error,       setError]       = useState('');
  const [saving,      setSaving]      = useState(false);

  const reset = () => {
    setUsername(''); setDisplayName(''); setPassword(''); setRoleId(''); setError('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleId) { setError('Seleccioná un rol.'); return; }
    setSaving(true);
    setError('');

    const res = await requestJson('/api/admin/users', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username, password, roleId, displayName }),
    }, 'Error al crear el usuario.');

    if (!res.ok) {
      setError(res.error);
      setSaving(false);
      return;
    }

    reset();
    setOpen(false);
    setSaving(false);
    onCreated();
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white
                   hover:bg-green-700 transition-colors"
      >
        <UserPlus className="h-4 w-4" />
        Crear usuario
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-green-200 bg-green-50 p-6 dark:border-green-900/40 dark:bg-green-950/20">
      <h3 className="mb-4 text-sm font-semibold text-gray-800 dark:text-slate-200">Nuevo usuario</h3>
      <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2">

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600 dark:text-slate-400">Usuario *</label>
          <input
            required
            value={username}
            onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
            placeholder="juan_perez"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-green-500"
          />
          <p className="text-xs text-gray-400">Solo minúsculas y guión bajo</p>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600 dark:text-slate-400">Nombre visible</label>
          <input
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="Juan Pérez"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-green-500"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600 dark:text-slate-400">Contraseña *</label>
          <div className="relative">
            <input
              required
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              minLength={8}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-9 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600 dark:text-slate-400">Rol *</label>
          <select
            required
            value={roleId}
            onChange={e => setRoleId(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-green-500"
          >
            <option value="">Seleccioná un rol</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>

        {error && (
          <p className="sm:col-span-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </p>
        )}

        <div className="sm:col-span-2 flex gap-2 justify-end">
          <button
            type="button"
            onClick={() => { reset(); setOpen(false); }}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Creando...' : 'Crear usuario'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Modal reset contraseña ────────────────────────────────
interface ResetPasswordModalProps {
  user:    UserWithRoles & { username?: string | null };
  onClose: () => void;
}

function ResetPasswordModal({ user, onClose }: ResetPasswordModalProps) {
  const [newPass,  setNewPass]  = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [showPass, setShowPass] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const [ok,       setOk]       = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass.length < 8)    { setError('Mínimo 8 caracteres.'); return; }
    if (newPass !== confirm)   { setError('Las contraseñas no coinciden.'); return; }
    setSaving(true); setError('');
    const res = await requestJson('/api/admin/users', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ userId: user.id, newPassword: newPass }),
    }, 'Error al cambiar la contraseña.');
    if (!res.ok) { setError(res.error); setSaving(false); return; }
    setOk(true); setSaving(false);
  };

  const display = user.display_name ?? (user as UserWithRoles & { username?: string | null }).username ?? user.email;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-700 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-green-600" /> Cambiar contraseña
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-6">
          <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
            Cambiando contraseña de <span className="font-medium text-gray-800 dark:text-slate-200">{display}</span>
          </p>
          {ok ? (
            <div className="rounded-lg bg-green-50 dark:bg-green-900/20 px-4 py-3 text-sm text-green-700 dark:text-green-400">
              ✓ Contraseña actualizada correctamente.
              <button onClick={onClose} className="ml-2 underline">Cerrar</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  required minLength={8}
                  placeholder="Nueva contraseña"
                  value={newPass}
                  onChange={e => setNewPass(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-9 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-green-500"
                />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <input
                type="password"
                required
                placeholder="Repetir contraseña"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-green-500"
              />
              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">{error}</p>}
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-800">Cancelar</button>
                <button type="submit" disabled={saving} className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {saving ? 'Guardando...' : 'Cambiar'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Página principal ──────────────────────────────────────
export default function AdminPage() {
  const { isAdmin, loading: permLoading } = usePermissions();
  const [users,       setUsers]       = useState<UserWithRoles[]>([]);
  const [roles,       setRoles]       = useState<Role[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [adding,      setAdding]      = useState<string | null>(null);
  const [saving,      setSaving]      = useState(false);
  const [resettingPw, setResettingPw] = useState<UserWithRoles | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [profilesRes, rolesRes] = await Promise.all([
      supabase.from('profiles').select(`
        id, email, username, display_name,
        user_roles ( role:roles ( id, name, description ) )
      `),
      supabase.from('roles').select('id, name, description').order('name'),
    ]);

    if (profilesRes.data) {
      const rows = profilesRes.data as unknown as ProfileRow[];
      setUsers(
        rows.map((p) => ({
          id:           p.id,
          email:        p.email,
          display_name: p.display_name,
          username:     p.username,
          roles: p.user_roles.map((ur) => ({
            id:          ur.role.id,
            name:        ur.role.name,
            description: ur.role.description,
          })),
        }))
      );
    }
    if (rolesRes.data) setRoles(rolesRes.data as Role[]);
    setLoading(false);
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]); // eslint-disable-line react-hooks/set-state-in-effect

  const addRole = async (userId: string, roleId: string) => {
    setSaving(true);
    await supabase.from('user_roles').insert({ user_id: userId, role_id: roleId });
    setAdding(null);
    await fetchData();
    setSaving(false);
  };

  const removeRole = async (userId: string, roleId: string) => {
    setSaving(true);
    await supabase.from('user_roles').delete().eq('user_id', userId).eq('role_id', roleId);
    await fetchData();
    setSaving(false);
  };

  const deleteUser = async (userId: string) => {
    if (!confirm('¿Seguro que querés eliminar este usuario?')) return;
    setSaving(true);
    const res = await requestJson(`/api/admin/users?userId=${encodeURIComponent(userId)}`, { method: 'DELETE' },
      'No se pudo eliminar el usuario.');
    if (res.ok) toast.success('Usuario eliminado');
    else toast.error(res.error);
    await fetchData();
    setSaving(false);
  };

  const availableRoles = (user: UserWithRoles) =>
    roles.filter((r) => !user.roles.some((ur) => ur.id === r.id));

  if (permLoading || loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-gray-400">
        <ShieldCheck className="h-10 w-10" />
        <p className="text-sm">No tenés permisos para acceder a esta sección.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-7 w-7 text-green-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Administración</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400">Gestión de usuarios y roles</p>
          </div>
        </div>
        <CreateUserForm roles={roles} onCreated={fetchData} />
      </div>

      {/* Referencia de roles */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-slate-300">Roles disponibles</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {roles.map((role) => (
            <div key={role.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3 dark:border-slate-700 dark:bg-slate-800">
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_COLORS[role.name] ?? 'bg-gray-100 text-gray-600'}`}>
                {role.name}
              </span>
              {role.description && (
                <p className="mt-1.5 text-xs text-gray-500 dark:text-slate-400">{role.description}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Tabla de usuarios */}
      <section className="rounded-xl border border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="border-b border-gray-200 px-6 py-4 dark:border-slate-700">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">
            Usuarios ({users.length})
          </h2>
        </div>

        <div className="divide-y divide-gray-100 dark:divide-slate-800">
          {users.map((user) => {
            const display = user.display_name ?? (user as UserWithRoles & { username?: string }).username ?? user.email;
            const sub     = (user as UserWithRoles & { username?: string }).username
              ? `@${(user as UserWithRoles & { username?: string }).username}`
              : user.email;

            return (
              <div key={user.id} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:gap-6">

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-slate-100">{display}</p>
                  <p className="truncate text-xs text-gray-500 dark:text-slate-400">{sub}</p>
                </div>

                {/* Roles actuales */}
                <div className="flex flex-wrap items-center gap-2">
                  {user.roles.length === 0 && (
                    <span className="text-xs text-gray-400 dark:text-slate-500">Sin roles</span>
                  )}
                  {user.roles.map((role) => (
                    <span
                      key={role.id}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_COLORS[role.name] ?? 'bg-gray-100 text-gray-600'}`}
                    >
                      {role.name}
                      <button
                        onClick={() => removeRole(user.id, role.id)}
                        disabled={saving}
                        className="ml-0.5 rounded-full p-0.5 hover:bg-black/10 disabled:opacity-50"
                        title="Quitar rol"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>

                {/* Agregar rol */}
                <div className="relative shrink-0 flex items-center gap-2">
                  {availableRoles(user).length > 0 && (
                    <div className="relative">
                      <button
                        onClick={() => setAdding(adding === user.id ? null : user.id)}
                        className="flex items-center gap-1 rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-xs text-gray-500
                                   hover:border-green-400 hover:text-green-600 transition-colors
                                   dark:border-slate-600 dark:text-slate-400 dark:hover:border-green-500 dark:hover:text-green-400"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Rol
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>

                      {adding === user.id && (
                        <div className="absolute right-0 top-full z-10 mt-1 w-52 rounded-xl border border-gray-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                          {availableRoles(user).map((role) => (
                            <button
                              key={role.id}
                              onClick={() => addRole(user.id, role.id)}
                              disabled={saving}
                              className="flex w-full flex-col px-4 py-2.5 text-left text-sm hover:bg-gray-50 disabled:opacity-50 dark:hover:bg-slate-800 first:rounded-t-xl last:rounded-b-xl"
                            >
                              <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[role.name] ?? 'bg-gray-100'}`}>
                                {role.name}
                              </span>
                              {role.description && (
                                <span className="mt-0.5 text-xs text-gray-400 dark:text-slate-500">{role.description}</span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Resetear contraseña */}
                  <button
                    onClick={() => setResettingPw(user)}
                    disabled={saving}
                    className="rounded-lg border border-dashed border-blue-200 px-2 py-1.5 text-xs text-blue-400
                               hover:border-blue-400 hover:text-blue-600 transition-colors disabled:opacity-50
                               dark:border-blue-900/40 dark:text-blue-500 dark:hover:border-blue-500"
                    title="Cambiar contraseña"
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                  </button>

                  {/* Eliminar usuario */}
                  <button
                    onClick={() => deleteUser(user.id)}
                    disabled={saving}
                    className="rounded-lg border border-dashed border-red-200 px-2 py-1.5 text-xs text-red-400
                               hover:border-red-400 hover:text-red-600 transition-colors disabled:opacity-50
                               dark:border-red-900/40 dark:text-red-500 dark:hover:border-red-500"
                    title="Eliminar usuario"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      </section>

      {resettingPw && (
        <ResetPasswordModal
          user={resettingPw}
          onClose={() => setResettingPw(null)}
        />
      )}
    </div>
  );
}
