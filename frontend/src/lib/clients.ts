import { supabase } from './supabase';
import { getDeviceId, sanitizeSearch } from './utils';
import type { Client, CreateClientDTO, UpdateClientDTO, PaginationParams } from '@/types';

export async function getClients(
  params: PaginationParams & { search?: string; status?: string }
) {
  const { page, pageSize, search, status } = params;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('clients')
    .select('*', { count: 'exact' })
    .eq('deleted', false)
    .order('created_at', { ascending: false })
    .range(from, to);

  // Comas o paréntesis en el texto (p. ej. "Jardines, C.A.") rompían el filtro .or()
  const term = search ? sanitizeSearch(search) : '';
  if (term) {
    query = query.or(`name.ilike.%${term}%,rif.ilike.%${term}%,phone.ilike.%${term}%`);
  }
  if (status) {
    query = query.eq('client_status', status);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: data as Client[], total: count ?? 0 };
}

export async function getClientById(id: string): Promise<Client> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .eq('deleted', false)
    .single();

  if (error) throw error;
  return data as Client;
}

export async function createClient(dto: CreateClientDTO): Promise<Client> {
  const { data, error } = await supabase
    .from('clients')
    .insert({ ...dto, created_by: getDeviceId() })
    .select()
    .single();

  if (error) throw error;
  return data as Client;
}

export async function updateClient(id: string, dto: UpdateClientDTO): Promise<Client> {
  const { data, error } = await supabase
    .from('clients')
    .update({ ...dto, updated_by: getDeviceId() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Client;
}

export async function deleteClient(id: string): Promise<void> {
  const { error } = await supabase
    .from('clients')
    .update({ deleted: true, updated_by: getDeviceId() })
    .eq('id', id);

  if (error) throw error;
}
