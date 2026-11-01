'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  adjustStock, cancelSale, createProduct, createSeller, deleteProduct, getLowStock,
  getProducts, getSales, getSalesMetrics, getSellers, inventoryErrorMessage,
  lowStockMessage, registerSale, setSaleStatus, updateProduct, updateSeller,
} from '@/lib/inventory';
import { formatCurrency } from '@/lib/utils';
import type { ProductDTO, RegisterSaleInput, SaleStatus, Seller } from '@/types/inventory';

export const inventoryKeys = {
  products: ['products'] as const,
  lowStock: ['products', 'low'] as const,
  sellers:  ['sellers'] as const,
  sales:    ['sales'] as const,
  metrics:  ['sales', 'metrics'] as const,
};

/** Después de una venta, compra o ajuste cambia el stock y las métricas. */
function useInvalidateStock() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: inventoryKeys.products });
    qc.invalidateQueries({ queryKey: inventoryKeys.sales });
  };
}

const fail = (fallback: string) => (error: unknown) => toast.error(inventoryErrorMessage(error, fallback));

// ─── Productos ──────────────────────────────────────────────

export function useProducts(params: { search?: string; lowOnly?: boolean } = {}) {
  return useQuery({
    queryKey: [...inventoryKeys.products, 'list', params],
    queryFn:  () => getProducts(params),
    placeholderData: (prev) => prev,
  });
}

export function useLowStock(enabled = true) {
  return useQuery({
    queryKey: inventoryKeys.lowStock,
    queryFn:  getLowStock,
    enabled,
    staleTime: 60_000,
  });
}

export function useSaveProduct() {
  const invalidate = useInvalidateStock();
  return useMutation({
    mutationFn: ({ id, dto }: { id?: string; dto: ProductDTO }) =>
      id ? updateProduct(id, dto) : createProduct(dto).then(() => undefined),
    onSuccess: (_, { id }) => {
      invalidate();
      toast.success(id ? 'Producto actualizado' : 'Producto creado');
    },
  });
}

export function useDeleteProduct() {
  const invalidate = useInvalidateStock();
  return useMutation({
    mutationFn: (id: string) => deleteProduct(id),
    onSuccess: () => { invalidate(); toast.success('Producto eliminado'); },
    onError:   fail('No se pudo eliminar el producto'),
  });
}

export function useAdjustStock() {
  const invalidate = useInvalidateStock();
  return useMutation({
    mutationFn: adjustStock,
    onSuccess: () => { invalidate(); toast.success('Stock actualizado'); },
  });
}

// ─── Vendedores ─────────────────────────────────────────────

export function useSellers() {
  return useQuery({ queryKey: inventoryKeys.sellers, queryFn: getSellers });
}

export function useCreateSeller() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => createSeller(name),
    onSuccess: (s: Seller) => {
      qc.invalidateQueries({ queryKey: inventoryKeys.sellers });
      toast.success(`${s.name} ya puede registrar ventas`);
    },
  });
}

export function useUpdateSeller() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: Partial<Pick<Seller, 'name' | 'active'>> }) =>
      updateSeller(id, changes),
    onSuccess: () => qc.invalidateQueries({ queryKey: inventoryKeys.sellers }),
    onError:   fail('No se pudo actualizar el vendedor'),
  });
}

// ─── Ventas ─────────────────────────────────────────────────

export function useSales(params: Parameters<typeof getSales>[0]) {
  return useQuery({
    queryKey: [...inventoryKeys.sales, 'list', params],
    queryFn:  () => getSales(params),
    placeholderData: (prev) => prev,
  });
}

export function useRegisterSale() {
  const invalidate = useInvalidateStock();
  return useMutation({
    mutationFn: (input: RegisterSaleInput) => registerSale(input),
    onSuccess: (result) => {
      invalidate();
      toast.success(`Venta registrada por ${formatCurrency(result.total)}`);
      // Alerta de compra: un aviso por producto que llegó al mínimo
      result.low_stock.forEach((p) => toast.warning(lowStockMessage(p), { duration: 10_000 }));
    },
  });
}

export function useSetSaleStatus() {
  const invalidate = useInvalidateStock();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: SaleStatus }) => setSaleStatus(id, status),
    onSuccess: (_, { status }) => {
      invalidate();
      toast.success(status === 'paid' ? 'Marcada como pagada' : 'Vuelve a estar a cuenta');
    },
    onError: fail('No se pudo actualizar la venta'),
  });
}

export function useCancelSale() {
  const invalidate = useInvalidateStock();
  return useMutation({
    mutationFn: (id: string) => cancelSale(id),
    onSuccess: () => { invalidate(); toast.success('Venta anulada. El stock volvió al inventario.'); },
    onError:   fail('No se pudo anular la venta'),
  });
}

// ─── Métricas ───────────────────────────────────────────────

export function useSalesMetrics(from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: [...inventoryKeys.metrics, from, to],
    queryFn:  () => getSalesMetrics(from, to),
    enabled,
    placeholderData: (prev) => prev,
  });
}
