import { supabase } from './supabase';
import { pgCode } from './errors';
import { monthRange, sanitizeSearch, toLocalISODate } from './utils';
import type {
  LowStockProduct, Product, ProductDTO, RegisterSaleInput, RegisterSaleResult,
  Sale, SaleItem, SaleStatus, SalesMetrics, Seller, StockMovement,
} from '@/types/inventory';

// ─── Formato ────────────────────────────────────────────────

/** Cantidad sin decimales de más: 3 → "3", 2.5 → "2,5". */
export function formatQty(n: number): string {
  return Number(n).toLocaleString('es-VE', { maximumFractionDigits: 2 });
}

export type StockLevel = 'out' | 'low' | 'ok';

/** "Sin stock" si no queda nada; "bajo" si llegó al mínimo. */
export function stockLevel(p: Pick<Product, 'stock_current' | 'stock_min'>): StockLevel {
  if (Number(p.stock_current) <= 0) return 'out';
  if (Number(p.stock_current) <= Number(p.stock_min)) return 'low';
  return 'ok';
}

export function lowStockMessage(p: LowStockProduct): string {
  return Number(p.stock_current) <= 0
    ? `${p.name} se quedó sin stock. Hay que comprar más.`
    : `Quedan ${formatQty(p.stock_current)} de ${p.name} (mínimo ${formatQty(p.stock_min)}). Hay que comprar más.`;
}

// ─── Errores de las RPC ─────────────────────────────────────

const RPC_MESSAGES: Record<string, string> = {
  venta_sin_items:      'Agregá al menos un producto.',
  demasiados_items:     'Una venta puede tener hasta 100 productos.',
  cantidad_invalida:    'Revisá las cantidades: tienen que ser mayores a 0 y con hasta 2 decimales.',
  producto_inexistente: 'Uno de los productos ya no existe. Recargá la página.',
  vendedor_invalido:    'El vendedor no existe o está inactivo.',
  cliente_invalido:     'El cliente no existe o fue eliminado.',
  venta_inexistente:    'La venta ya fue anulada.',
  tipo_invalido:        'Tipo de movimiento inválido.',
  rango_invalido:       'Revisá las fechas del período.',
  sin_empresa:          'No tenés una empresa activa.',
};

function errorText(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return typeof error === 'string' ? error : '';
}

/** Traduce los errores de productos/ventas a un mensaje para el usuario. */
export function inventoryErrorMessage(error: unknown, fallback: string): string {
  const text = errorText(error);

  const stock = /stock_insuficiente:(.+):(-?[\d.]+)$/.exec(text);
  if (stock) return `No hay stock suficiente de ${stock[1]}: quedan ${formatQty(Number(stock[2]))}.`;

  const negative = /stock_negativo:(-?[\d.]+)/.exec(text);
  if (negative) return `El stock no puede quedar negativo (hay ${formatQty(Number(negative[1]))}).`;

  if (text.startsWith('sin_permiso')) return 'No tenés permiso para hacer esto.';
  if (pgCode(error) === '23505') return 'Ya existe uno con ese nombre.';

  return RPC_MESSAGES[text] ?? fallback;
}

// ─── Productos ──────────────────────────────────────────────

export async function getProducts(params: { search?: string; lowOnly?: boolean } = {}): Promise<Product[]> {
  const term = params.search ? sanitizeSearch(params.search) : '';

  if (params.lowOnly) {
    let q = supabase.from('low_stock_products').select('id').order('name');
    if (term) q = q.or(`name.ilike.%${term}%,sku.ilike.%${term}%`);
    const { data: low, error } = await q;
    if (error) throw error;
    const ids = (low ?? []).map((r: { id: string }) => r.id);
    if (ids.length === 0) return [];
    const { data, error: e2 } = await supabase.from('products').select('*').in('id', ids).order('name');
    if (e2) throw e2;
    return (data ?? []) as Product[];
  }

  let query = supabase.from('products').select('*').eq('deleted', false).order('name').limit(1000);
  if (term) query = query.or(`name.ilike.%${term}%,sku.ilike.%${term}%`);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Product[];
}

export async function getLowStock(): Promise<LowStockProduct[]> {
  const { data, error } = await supabase
    .from('low_stock_products')
    .select('id, name, unit, stock_current, stock_min')
    .order('stock_current');
  if (error) throw error;
  return (data ?? []) as LowStockProduct[];
}

export async function createProduct(dto: ProductDTO): Promise<Product> {
  const { data, error } = await supabase.from('products').insert(dto).select().single();
  if (error) throw error;
  return data as Product;
}

export async function updateProduct(id: string, dto: Omit<ProductDTO, 'stock_current'>): Promise<void> {
  const { error } = await supabase
    .from('products')
    .update({ ...dto, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase
    .from('products')
    .update({ deleted: true, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function adjustStock(params: {
  productId: string; quantity: number; kind: 'purchase' | 'adjustment'; notes?: string;
}): Promise<number> {
  const { data, error } = await supabase.rpc('adjust_stock', {
    p_product_id: params.productId,
    p_quantity:   params.quantity,
    p_kind:       params.kind,
    p_notes:      params.notes?.trim() || null,
  });
  if (error) throw error;
  return Number(data);
}

export async function getStockMovements(productId: string): Promise<StockMovement[]> {
  const { data, error } = await supabase
    .from('stock_movements')
    .select('id, kind, quantity, stock_after, notes, created_at')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as StockMovement[];
}

// ─── Vendedores ─────────────────────────────────────────────

export async function getSellers(): Promise<Seller[]> {
  const { data, error } = await supabase.from('sellers').select('*').order('name');
  if (error) throw error;
  return (data ?? []) as Seller[];
}

export async function createSeller(name: string): Promise<Seller> {
  const { data, error } = await supabase.from('sellers').insert({ name: name.trim() }).select().single();
  if (error) throw error;
  return data as Seller;
}

export async function updateSeller(id: string, changes: Partial<Pick<Seller, 'name' | 'active'>>): Promise<void> {
  const { error } = await supabase
    .from('sellers')
    .update(changes.name !== undefined ? { ...changes, name: changes.name.trim() } : changes)
    .eq('id', id);
  if (error) throw error;
}

// ─── Ventas ─────────────────────────────────────────────────

const SALE_SELECT = 'id, client_id, seller_id, sale_date, total, status, notes, paid_at, created_at, client:clients(id, name), seller:sellers(id, name)';

/** PostgREST devuelve las relaciones a uno como objeto o como array según el caso. */
function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

function toSale(row: Record<string, unknown>): Sale {
  return {
    ...(row as unknown as Sale),
    total:  Number(row.total),
    client: one(row.client as Sale['client']),
    seller: one(row.seller as Sale['seller']),
  };
}

export async function getSales(params: {
  page: number; pageSize: number; status?: SaleStatus; sellerId?: string; clientId?: string;
}): Promise<{ data: Sale[]; total: number }> {
  const from = (params.page - 1) * params.pageSize;
  let query = supabase
    .from('sales')
    .select(SALE_SELECT, { count: 'exact' })
    .eq('deleted', false)
    .order('sale_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, from + params.pageSize - 1);
  if (params.status)   query = query.eq('status', params.status);
  if (params.sellerId) query = query.eq('seller_id', params.sellerId);
  if (params.clientId) query = query.eq('client_id', params.clientId);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: (data ?? []).map((r) => toSale(r as Record<string, unknown>)), total: count ?? 0 };
}

export async function getSaleItems(saleId: string): Promise<SaleItem[]> {
  const { data, error } = await supabase
    .from('sale_items')
    .select('id, product_id, quantity, unit_price, total, product:products(name, unit)')
    .eq('sale_id', saleId);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    ...(r as unknown as SaleItem),
    product: one((r as { product: SaleItem['product'] | SaleItem['product'][] }).product),
  }));
}

/** Lo que el cliente debe: suma de sus ventas pendientes. */
export async function getClientBalance(clientId: string): Promise<{ pending: number; count: number }> {
  const { data, error } = await supabase
    .from('sales')
    .select('total')
    .eq('deleted', false)
    .eq('status', 'pending')
    .eq('client_id', clientId);
  if (error) throw error;
  const rows = data ?? [];
  return { pending: rows.reduce((s, r) => s + Number(r.total), 0), count: rows.length };
}

export async function registerSale(input: RegisterSaleInput): Promise<RegisterSaleResult> {
  const { data, error } = await supabase.rpc('register_sale', {
    p_seller_id: input.seller_id,
    p_items:     input.items,
    p_client_id: input.client_id,
    p_sale_date: input.sale_date,
    p_status:    input.status,
    p_notes:     input.notes,
  });
  if (error) throw error;
  const result = data as RegisterSaleResult;
  return { ...result, total: Number(result.total), low_stock: result.low_stock ?? [] };
}

export async function setSaleStatus(id: string, status: SaleStatus): Promise<void> {
  const { error } = await supabase
    .from('sales')
    .update({ status, paid_at: status === 'paid' ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) throw error;
}

export async function cancelSale(id: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_sale', { p_sale_id: id });
  if (error) throw error;
}

// ─── Métricas ───────────────────────────────────────────────

export type RangePreset = 'month' | 'last_month' | '7d' | '30d' | 'year';

/** Rango de fechas locales (YYYY-MM-DD) para cada atajo. */
export function presetRange(preset: RangePreset, today = new Date()): { from: string; to: string } {
  const daysAgo = (n: number) => toLocalISODate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - n));
  switch (preset) {
    case 'month':      { const r = monthRange(today); return { from: r.start, to: r.end }; }
    case 'last_month': { const r = monthRange(new Date(today.getFullYear(), today.getMonth() - 1, 1)); return { from: r.start, to: r.end }; }
    case '7d':         return { from: daysAgo(6),  to: toLocalISODate(today) };
    case '30d':        return { from: daysAgo(29), to: toLocalISODate(today) };
    case 'year':       return { from: `${today.getFullYear()}-01-01`, to: `${today.getFullYear()}-12-31` };
  }
}


export async function getSalesMetrics(from: string, to: string): Promise<SalesMetrics> {
  const { data, error } = await supabase.rpc('sales_metrics', { p_from: from, p_to: to });
  if (error) throw error;
  const m = data as SalesMetrics;
  const num = <T extends object>(rows: T[], keys: (keyof T)[]) =>
    rows.map((r) => ({ ...r, ...Object.fromEntries(keys.map((k) => [k, Number(r[k])])) }));
  return {
    totals:   {
      sales:   Number(m.totals.sales),
      revenue: Number(m.totals.revenue),
      pending: Number(m.totals.pending),
      units:   Number(m.totals.units),
    },
    sellers:  num(m.sellers ?? [],  ['sales', 'revenue', 'units']),
    products: num(m.products ?? [], ['units', 'revenue']),
    daily:    num(m.daily ?? [],    ['sales', 'revenue']),
  };
}
