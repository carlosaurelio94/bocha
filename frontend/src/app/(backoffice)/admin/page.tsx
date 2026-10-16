'use client';

import { useEffect, useState, useCallback } from 'react';
import { ShieldCheck, UserPlus, KeyRound, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { requestJson } from '@/lib/http';
import { usePermissions } from '@/hooks/usePermissions';
import { normalizeUsername, MIN_PASSWORD } from '@/lib/signupValidation';
import { roleLabel } from '@/lib/roles';
import { Avatar }        from '@/components/ui/Avatar';
import { Button }        from '@/components/ui/Button';
import { Card }          from '@/components/ui/Card';
import { EmptyState }    from '@/components/ui/EmptyState';
import { Input }         from '@/components/ui/Input';
import { Modal }         from '@/components/ui/Modal';
import { PageHeader }    from '@/components/ui/PageHeader';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Select }        from '@/components/ui/Select';
import { ListSkeleton }  from '@/components/ui/Skeleton';
import type { Role, UserWithRoles } from '@/types/permissions';

// ─── tipos crudos de Supabase ──────────────────────────────
interface ProfileRow {
  id:           string;
  email:        string;
  username:     string | null;
  display_name: string | null;
  user_roles: { role: { id: string; name: string; description: string | null } }[];
}


// ─── Modal: crear usuario ──────────────────────────────────
function CreateUserModal({ open, roles, onClose, onCreated }: {
  open: boolean; roles: Role[]; onClose: () => void; onCreated: () => void;
}) {
  const [username,    setUsername]    = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password,    setPassword]    = useState('');
  const [roleId,      setRoleId]      = useState('');
  const [error,       setError]       = useState('');
  const [saving,      setSaving]      = useState(false);

  const close = () => {
    setUsername(''); setDisplayName(''); setPassword(''); setRoleId(''); setError('');
    onClose();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (username.length < 3)          { setError('El usuario debe tener al menos 3 caracteres.'); return; }
    if (password.length < MIN_PASSWORD) { setError(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`); return; }
    if (!roleId)                      { setError('Elegí qué va a poder hacer.'); return; }

    setSaving(true);
    setError('');
    const res = await requestJson('/api/admin/users', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username, password, roleId, displayName }),
    }, 'No se pudo crear el usuario.');
    setSaving(false);

    if (!res.ok) { setError(res.error); return; }
    toast.success(`Usuario ${username} creado`);
    close();
    onCreated();
  };

  return (
    <Modal open={open} onClose={close} title="Nuevo usuario" description="Va a entrar con este usuario y contraseña.">
      <form onSubmit={handleCreate} className="flex flex-col gap-4" noValidate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Nombre" id="new-user-display" value={displayName} placeholder="Juan Pérez"
            onChange={(e) => setDisplayName(e.target.value)} />
          <Input label="Usuario" id="new-user-username" required value={username} placeholder="juan_perez"
            autoCapitalize="none" autoCorrect="off" spellCheck={false}
            hint="Minúsculas, números o guion bajo."
            onChange={(e) => setUsername(normalizeUsername(e.target.value))} />
        </div>
        <PasswordInput label="Contraseña" id="new-user-password" required autoComplete="new-password"
          value={password} onChange={(e) => setPassword(e.target.value)} hint={`Mínimo ${MIN_PASSWORD} caracteres.`} />
        <Select label="Rol" id="new-user-role" required value={roleId} onChange={(e) => setRoleId(e.target.value)}>
          <option value="">Elegí qué va a poder hacer…</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>{roleLabel(r.name)}{r.description ? ` — ${r.description}` : ''}</option>
          ))}
        </Select>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">{error}</p>
        )}

        <div className="flex flex-col-reverse gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end dark:border-slate-800">
          <Button type="button" variant="secondary" onClick={close} disabled={saving}>Cancelar</Button>
          <Button type="submit" loading={saving}>Crear usuario</Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Modal: resetear contraseña ────────────────────────────
function ResetPasswordModal({ user, onClose }: { user: UserWithRoles | null; onClose: () => void }) {
  const [newPass, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  const close = () => { setNewPass(''); setConfirm(''); setError(''); onClose(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (newPass.length < MIN_PASSWORD) { setError(`Mínimo ${MIN_PASSWORD} caracteres.`); return; }
    if (newPass !== confirm)           { setError('Las contraseñas no coinciden.'); return; }
    setSaving(true); setError('');
    const res = await requestJson('/api/admin/users', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ userId: user.id, newPassword: newPass }),
    }, 'No se pudo cambiar la contraseña.');
    setSaving(false);
    if (!res.ok) { setError(res.error); return; }
    toast.success('Contraseña actualizada. Pasásela por un canal seguro.');
    close();
  };

  return (
    <Modal open={!!user} onClose={close} title="Cambiar contraseña" size="sm"
      description={user ? `De ${user.display_name ?? user.username ?? user.email}` : undefined}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <PasswordInput label="Nueva contraseña" id="reset-new" required autoComplete="new-password"
          value={newPass} onChange={(e) => setNewPass(e.target.value)} hint={`Mínimo ${MIN_PASSWORD} caracteres.`} />
        <PasswordInput label="Repetir contraseña" id="reset-confirm" required autoComplete="new-password"
          value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">{error}</p>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={close} disabled={saving}>Cancelar</Button>
          <Button type="submit" loading={saving}>Cambiar contraseña</Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Modal: quitar usuario ─────────────────────────────────
function RemoveUserModal({ user, onClose, onRemoved }: {
  user: UserWithRoles | null; onClose: () => void; onRemoved: () => void;
}) {
  const [saving, setSaving] = useState(false);

  const handleRemove = async () => {
    if (!user) return;
    setSaving(true);
    const res = await requestJson(`/api/admin/users?userId=${encodeURIComponent(user.id)}`, { method: 'DELETE' },
      'No se pudo quitar el usuario.');
    setSaving(false);
    if (!res.ok) { toast.error(res.error); return; }
    toast.success('Usuario quitado de la empresa');
    onClose();
    onRemoved();
  };

  return (
    <Modal open={!!user} onClose={onClose} title="Quitar usuario" size="sm">
      <div className="flex flex-col gap-5">
        <p className="text-sm text-gray-600 dark:text-slate-300">
          <span className="font-semibold text-gray-900 dark:text-slate-100">{user?.display_name ?? user?.username}</span>{' '}
          ya no va a poder entrar a esta empresa. Lo que cargó (clientes, presupuestos) se mantiene.
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button variant="danger" loading={saving} onClick={handleRemove}>Sí, quitar</Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Página principal ──────────────────────────────────────
export default function AdminPage() {
  const { isAdmin, loading: permLoading } = usePermissions();
  const [users,       setUsers]       = useState<UserWithRoles[]>([]);
  const [roles,       setRoles]       = useState<Role[]>([]);
  const [meId,        setMeId]        = useState<string | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [changing,    setChanging]    = useState<string | null>(null);
  const [creating,    setCreating]    = useState(false);
  const [resettingPw, setResettingPw] = useState<UserWithRoles | null>(null);
  const [removing,    setRemoving]    = useState<UserWithRoles | null>(null);

  const fetchData = useCallback(async () => {
    const [profilesRes, rolesRes, meRes] = await Promise.all([
      supabase.from('profiles').select(`
        id, email, username, display_name,
        user_roles ( role:roles ( id, name, description ) )
      `),
      supabase.from('roles').select('id, name, description').order('name'),
      supabase.auth.getUser(),
    ]);

    if (profilesRes.error) toast.error('No se pudieron cargar los usuarios.');
    const rows = (profilesRes.data ?? []) as unknown as ProfileRow[];
    setUsers(
      rows
        // Solo miembros de esta empresa (user_roles ya viene filtrado por la empresa activa)
        .filter((p) => (p.user_roles ?? []).length > 0)
        .map((p) => ({
          id:           p.id,
          email:        p.email,
          display_name: p.display_name,
          username:     p.username,
          roles: p.user_roles.map((ur) => ({ id: ur.role.id, name: ur.role.name, description: ur.role.description })),
        }))
    );
    setRoles((rolesRes.data ?? []) as Role[]);
    setMeId(meRes.data.user?.id ?? null);
    setLoading(false);
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]); // eslint-disable-line react-hooks/set-state-in-effect

  /**
   * Cada usuario tiene UN rol por empresa: insertar en user_roles hace upsert
   * del rol. (Antes la UI mostraba varios roles y la ✕ de un rol borraba la
   * membresía, sacando al usuario de la empresa sin avisar.)
   */
  const changeRole = async (user: UserWithRoles, roleId: string) => {
    setChanging(user.id);
    const { error } = await supabase.from('user_roles').insert({ user_id: user.id, role_id: roleId });
    setChanging(null);
    if (error) { toast.error('No se pudo cambiar el rol.'); return; }
    toast.success(`Ahora ${user.display_name ?? user.username} es ${roleLabel(roles.find((r) => r.id === roleId)?.name ?? '')}`);
    await fetchData();
  };

  if (permLoading || (loading && isAdmin)) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Usuarios y roles" />
        <Card flush><ListSkeleton rows={3} /></Card>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="Sección solo para administradores"
        description="Pedile a un administrador de tu empresa que te dé acceso."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Usuarios y roles"
        description="Quién entra a tu backoffice y qué puede hacer."
        actions={
          <Button onClick={() => setCreating(true)}>
            <UserPlus className="h-4 w-4" />
            Nuevo usuario
          </Button>
        }
      />

      <Card flush title={`Usuarios (${users.length})`}>
        {users.length === 0 ? (
          <EmptyState icon={Users} title="Todavía no hay usuarios" description="Sumá a tu equipo para que carguen clientes y presupuestos." />
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-slate-800">
            {users.map((user) => {
              const isMe    = user.id === meId;
              const display = user.display_name ?? user.username ?? user.email;
              const current = user.roles[0];
              return (
                <li key={user.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-4">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar name={display} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-slate-100">
                        {display}{isMe && <span className="ml-1.5 text-xs font-normal text-gray-500 dark:text-slate-400">(vos)</span>}
                      </p>
                      <p className="truncate text-xs text-gray-500 dark:text-slate-400">{user.username ? `@${user.username}` : user.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="w-44">
                      <Select
                        aria-label={`Rol de ${display}`}
                        value={current?.id ?? ''}
                        disabled={isMe || changing === user.id}
                        title={isMe ? 'No podés cambiar tu propio rol' : undefined}
                        onChange={(e) => void changeRole(user, e.target.value)}
                      >
                        {!current && <option value="">Sin rol</option>}
                        {roles.map((r) => <option key={r.id} value={r.id}>{roleLabel(r.name)}</option>)}
                      </Select>
                    </div>
                    <button
                      onClick={() => setResettingPw(user)}
                      aria-label={`Cambiar contraseña de ${display}`}
                      title="Cambiar contraseña"
                      className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                    >
                      <KeyRound className="h-4 w-4" />
                    </button>
                    {!isMe && (
                      <button
                        onClick={() => setRemoving(user)}
                        aria-label={`Quitar a ${display}`}
                        title="Quitar de la empresa"
                        className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Referencia de roles */}
      <Card title="Qué puede hacer cada rol">
        <dl className="grid gap-4 sm:grid-cols-2">
          {roles.map((role) => (
            <div key={role.id}>
              <dt className="text-sm font-medium text-gray-900 dark:text-slate-100">{roleLabel(role.name)}</dt>
              {role.description && <dd className="mt-0.5 text-sm text-gray-500 dark:text-slate-400">{role.description}</dd>}
            </div>
          ))}
        </dl>
      </Card>

      <CreateUserModal open={creating} roles={roles} onClose={() => setCreating(false)} onCreated={fetchData} />
      <ResetPasswordModal user={resettingPw} onClose={() => setResettingPw(null)} />
      <RemoveUserModal user={removing} onClose={() => setRemoving(null)} onRemoved={fetchData} />
    </div>
  );
}
