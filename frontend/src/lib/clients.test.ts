import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSupabaseMock } from '@/test/supabaseMock';

const sb = vi.hoisted(() => ({ mock: null as unknown as ReturnType<typeof createSupabaseMock> }));
vi.mock('./supabase', async () => {
  const { createSupabaseMock } = await import('@/test/supabaseMock');
  sb.mock = createSupabaseMock();
  return { supabase: sb.mock.client };
});

import { getClients, getClientById, createClient, updateClient, deleteClient } from './clients';

beforeEach(() => {
  sb.mock.reset();
  localStorage.setItem('device_id', 'device_test');
});

describe('getClients', () => {
  it('pagina con range y excluye borrados', async () => {
    sb.mock.respond('clients', { data: [{ id: '1' }], count: 31 });

    const res = await getClients({ page: 3, pageSize: 15 });

    expect(res).toEqual({ data: [{ id: '1' }], total: 31 });
    const ops = sb.mock.lastOps('clients');
    expect(ops).toContainEqual(['eq', ['deleted', false]]);
    expect(ops).toContainEqual(['range', [30, 44]]);
    expect(ops).toContainEqual(['select', ['*', { count: 'exact' }]]);
  });

  it('busca por nombre, RIF o teléfono', async () => {
    await getClients({ page: 1, pageSize: 10, search: 'ana' });
    expect(sb.mock.lastOps('clients')).toContainEqual(
      ['or', ['name.ilike.%ana%,rif.ilike.%ana%,phone.ilike.%ana%']]
    );
  });

  it('filtra por estado solo si se pide', async () => {
    await getClients({ page: 1, pageSize: 10 });
    expect(sb.mock.lastOps('clients').some(([m, a]) => m === 'eq' && a[0] === 'client_status')).toBe(false);

    await getClients({ page: 1, pageSize: 10, status: 'prospect' });
    expect(sb.mock.lastOps('clients')).toContainEqual(['eq', ['client_status', 'prospect']]);
  });

  it('devuelve total 0 si Supabase no informa count', async () => {
    sb.mock.respond('clients', { data: [], count: null });
    expect((await getClients({ page: 1, pageSize: 10 })).total).toBe(0);
  });

  it('propaga el error de Supabase', async () => {
    sb.mock.respond('clients', { error: new Error('boom') });
    await expect(getClients({ page: 1, pageSize: 10 })).rejects.toThrow('boom');
  });
});

describe('getClientById', () => {
  it('pide un único cliente no borrado', async () => {
    sb.mock.respond('clients', { data: { id: 'x', name: 'Ana' } });
    expect(await getClientById('x')).toEqual({ id: 'x', name: 'Ana' });
    const ops = sb.mock.lastOps('clients');
    expect(ops).toContainEqual(['eq', ['id', 'x']]);
    expect(ops).toContainEqual(['eq', ['deleted', false]]);
    expect(ops.at(-1)?.[0]).toBe('single');
  });
});

describe('createClient / updateClient / deleteClient', () => {
  it('createClient registra created_by con el id del dispositivo', async () => {
    sb.mock.respond('clients', { data: { id: 'new' } });
    await createClient({ name: 'Ana', client_status: 'prospect' });
    expect(sb.mock.lastOps('clients')[0]).toEqual(
      ['insert', [{ name: 'Ana', client_status: 'prospect', created_by: 'device_test' }]]
    );
  });

  it('updateClient registra updated_by y filtra por id', async () => {
    sb.mock.respond('clients', { data: { id: 'c1' } });
    await updateClient('c1', { phone: '123' });
    const ops = sb.mock.lastOps('clients');
    expect(ops[0]).toEqual(['update', [{ phone: '123', updated_by: 'device_test' }]]);
    expect(ops).toContainEqual(['eq', ['id', 'c1']]);
  });

  it('deleteClient hace borrado lógico (no DELETE)', async () => {
    await deleteClient('c1');
    const ops = sb.mock.lastOps('clients');
    expect(ops[0]).toEqual(['update', [{ deleted: true, updated_by: 'device_test' }]]);
    expect(ops.some(([m]) => m === 'delete')).toBe(false);
  });

  it('deleteClient propaga errores', async () => {
    sb.mock.respond('clients', { error: new Error('rls') });
    await expect(deleteClient('c1')).rejects.toThrow('rls');
  });
});
