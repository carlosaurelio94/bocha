import { supabase } from './supabase';
import { getDeviceId, sanitizeSearch } from './utils';
import { pgCode } from './errors';

const MAX_NUMBER_RETRIES = 3;
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
    // Un presupuesto borrado no se puede abrir por URL
    .eq('deleted', false)
    // Solo los ítems vigentes: al editar, los reemplazados quedan con deleted = true
    .eq('items.deleted', false)
    .order('created_at', { referencedTable: 'quote_items', ascending: true })
    .single();

  if (error) throw error;
  return data as Quote;
}

/**
 * Inserta la cabecera. El número se calcula en el cliente: si otro usuario lo
 * tomó mientras tanto, el índice único (company_id, quote_number) devuelve
 * 23505 y se reintenta con el siguiente número libre.
 */
async function insertQuoteHeader(header: Omit<CreateQuoteDTO, 'items'> & { created_by: string }): Promise<Quote> {
  let quoteNumber = header.quote_number;
  for (let attempt = 0; ; attempt++) {
    const { data, error } = await supabase
      .from('quotes')
      .insert({ ...header, quote_number: quoteNumber })
      .select()
      .single();

    if (!error) return data as Quote;
    if (pgCode(error) !== '23505' || attempt >= MAX_NUMBER_RETRIES) throw error;
    quoteNumber = await getNextQuoteNumber();
  }
}

export async function createQuote(dto: CreateQuoteDTO): Promise<Quote> {
  const deviceId = getDeviceId();
  const { items, ...quoteData } = dto;

  // 1. Insert quote header
  const quote = await insertQuoteHeader({ ...quoteData, created_by: deviceId });

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

  return quote;
}

/**
 * Edita un presupuesto: cabecera + reemplazo de ítems.
 * Sin transacción en el cliente, así que se hace en un orden que permite
 * deshacer: 1) se insertan los ítems nuevos, 2) se dan de baja los viejos,
 * 3) se actualiza la cabecera. Si un paso falla, se revierten los anteriores
 * y el presupuesto queda como estaba.
 */
export async function updateQuote(id: string, dto: CreateQuoteDTO): Promise<void> {
  const deviceId = getDeviceId();
  const { items, ...header } = dto;

  const { data: oldRows, error: oldError } = await supabase
    .from('quote_items').select('id').eq('quote_id', id).eq('deleted', false);
  if (oldError) throw oldError;
  const oldIds = (oldRows ?? []).map((r: { id: string }) => r.id);

  // 1. Ítems nuevos
  const { data: newRows, error: insertError } = await supabase
    .from('quote_items')
    .insert(items.map((item) => ({
      ...item,
      quote_id:       id,
      client_id:      header.client_id,
      information_id: header.information_id,
      created_by:     deviceId,
    })))
    .select('id');
  if (insertError) throw insertError;
  const newIds = (newRows ?? []).map((r: { id: string }) => r.id);

  const discardNew = () => newIds.length > 0
    ? supabase.from('quote_items').update({ deleted: true, updated_by: deviceId }).in('id', newIds)
    : Promise.resolve();

  // 2. Baja de los viejos
  if (oldIds.length > 0) {
    const { error: deleteError } = await supabase
      .from('quote_items').update({ deleted: true, updated_by: deviceId }).in('id', oldIds);
    if (deleteError) {
      await discardNew();
      throw deleteError;
    }
  }

  // 3. Cabecera
  const { error: headerError } = await supabase
    .from('quotes')
    .update({ ...header, information_id: header.information_id ?? null, updated_by: deviceId, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (headerError) {
    await discardNew();
    if (oldIds.length > 0) {
      await supabase.from('quote_items').update({ deleted: false, updated_by: deviceId }).in('id', oldIds);
    }
    throw headerError;
  }
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
