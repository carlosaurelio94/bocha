// ─── Productos, stock, vendedores y ventas ──────────────────────────────────

export type SaleStatus = 'pending' | 'paid';
export type StockMovementKind = 'initial' | 'purchase' | 'adjustment' | 'sale' | 'sale_cancel';

export interface Product {
  id:            string;
  name:          string;
  sku:           string | null;
  unit:          string;
  price:         number;
  stock_current: number;
  stock_min:     number;
  created_at:    string;
  updated_at:    string | null;
  deleted:       boolean;
}

export interface ProductDTO {
  name:      string;
  sku:       string | null;
  unit:      string;
  price:     number;
  stock_min: number;
  /** Solo en el alta; después el stock cambia con compras, ajustes y ventas. */
  stock_current?: number;
}

export interface LowStockProduct {
  id:            string;
  name:          string;
  unit:          string;
  stock_current: number;
  stock_min:     number;
}

export interface Seller {
  id:         string;
  name:       string;
  active:     boolean;
  created_at: string;
}

export interface SaleItem {
  id:         string;
  product_id: string;
  quantity:   number;
  unit_price: number;
  total:      number;
  product:    { name: string; unit: string } | null;
}

export interface Sale {
  id:         string;
  client_id:  string | null;
  seller_id:  string;
  sale_date:  string;
  total:      number;
  status:     SaleStatus;
  notes:      string | null;
  paid_at:    string | null;
  created_at: string;
  client:     { id: string; name: string } | null;
  seller:     { id: string; name: string } | null;
  items?:     SaleItem[];
}

export interface SaleLineInput {
  product_id: string;
  quantity:   number;
}

export interface RegisterSaleInput {
  seller_id:  string;
  client_id:  string | null;
  sale_date:  string;
  status:     SaleStatus;
  notes:      string | null;
  items:      SaleLineInput[];
}

export interface RegisterSaleResult {
  sale_id:   string;
  total:     number;
  low_stock: LowStockProduct[];
}

export interface StockMovement {
  id:          string;
  kind:        StockMovementKind;
  quantity:    number;
  stock_after: number;
  notes:       string | null;
  created_at:  string;
}

export interface SalesMetrics {
  totals: { sales: number; revenue: number; pending: number; units: number };
  sellers: { id: string; name: string; active: boolean; sales: number; revenue: number; units: number }[];
  products: { id: string; name: string; unit: string; units: number; revenue: number }[];
  daily: { day: string; sales: number; revenue: number }[];
}
