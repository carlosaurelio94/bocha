import { supabase } from './supabase';
import { getDeviceId, sanitizeSearch } from './utils';
import type { Quote, CreateQuoteDTO, PaginationParams } from '@/types';

export async function getQuotes(
  params: PaginationParams & { search?: string; status?: string; clientId?: string }
) {
  const { page, pageSize, search, status, clientId } = params;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const term = search ? sanitizeSearch(search) : '';

  // Para filtrar por nombre del cliente hace falta `!inner`: sin eso PostgREST
  // no filtra los presupuestos, solo deja `client` en null en los que no matchean.
  const clientJoin = term ? 'client:clients!inner(id, name, rif)' : 'client:clients(id, name, rif)';

  let query = supabase
    .from('quotes')
    .select(`
      *,
      ${clientJoin},
      information:quote_information(id, name)
    `, { count: 'exact' })
    .eq('deleted', false)
    .order('quote_date', { ascending: false })
    .range(from, to);

  if (status) query = query.eq('status', status);
  if (clientId) query = query.eq('client_id', clientId);
  if (term) query = query.ilike('clients.name', `%${term}%`);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: data as Quote[], total: count ?? 0 };
}

export async function getQuoteById(id: string): Promise<Quote> {
  const { data, error } = await supabase
    .from('quotes')
    .select(`
      *,
      client:clients(*),
      information:quote_information(*),
      items:quote_items(*)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as Quote;
}

export async function createQuote(dto: CreateQuoteDTO): Promise<Quote> {
  const deviceId = getDeviceId();
  const { items, ...quoteData } = dto;

  // 1. Insert quote header
  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .insert({ ...quoteData, created_by: deviceId })
    .select()
    .single();

  if (quoteError) throw quoteError;

  // 2. Insert items in batch
  if (items.length > 0) {
    const { error: itemsError } = await supabase.from('quote_items').insert(
      items.map((item) => ({
        ...item,
        quote_id: quote.id,
        client_id: dto.client_id,
        information_id: dto.information_id,
        created_by: deviceId,
      }))
    );
    if (itemsError) {
      // Compensación: no dejar un presupuesto "huérfano" sin ítems.
      await supabase.from('quotes').update({ deleted: true, updated_by: deviceId }).eq('id', quote.id);
      throw itemsError;
    }
  }

  return quote as Quote;
}

export async function updateQuoteStatus(id: string, status: Quote['status']): Promise<void> {
  const { error } = await supabase
    .from('quotes')
    .update({ status, updated_by: getDeviceId() })
    .eq('id', id);

  if (error) throw error;
}

export async function deleteQuote(id: string): Promise<void> {
  const deviceId = getDeviceId();
  await supabase.from('quote_items').update({ deleted: true, updated_by: deviceId }).eq('quote_id', id);
  const { error } = await supabase.from('quotes').update({ deleted: true, updated_by: deviceId }).eq('id', id);
  if (error) throw error;
}

export async function getNextQuoteNumber(): Promise<number> {
  const { data, error } = await supabase
    .from('quotes')
    .select('quote_number')
    .order('quote_number', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return 1;
  return data.quote_number + 1;
}
