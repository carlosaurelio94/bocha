import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithQuery } from '@/test/render';
import { createSupabaseMock } from '@/test/supabaseMock';

const sb = vi.hoisted(() => ({ mock: null as unknown as ReturnType<typeof createSupabaseMock> }));
vi.mock('@/lib/supabase', async () => {
  const { createSupabaseMock } = await import('@/test/supabaseMock');
  sb.mock = createSupabaseMock();
  return { supabase: sb.mock.client };
});
const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

import SuppliersPage from './page';

const suppliers = [
  { id: 's1', legal_name: 'Insumos S.A.', fantasy_name: 'InsumosPro', category: 'Plantas', tax_id: '30-1' },
  { id: 's2', legal_name: 'Riego SRL', fantasy_name: null, category: null, tax_id: null },
];

beforeEach(() => { sb.mock.reset(); router.push.mockClear(); });

describe('SuppliersPage', () => {
  it('en mobile muestra tarjetas con nombre y datos clave', async () => {
    sb.mock.respond('suppliers', { data: suppliers, count: 2 });
    renderWithQuery(<SuppliersPage />);
    await screen.findAllByText('InsumosPro'); // la carga espera 300ms (debounce de búsqueda)
    const list = screen.getAllByRole('list')[0];
    expect(within(list).getByText('InsumosPro')).toBeInTheDocument();
    expect(within(list).getByText('Insumos S.A. · Plantas · 30-1')).toBeInTheDocument();
    expect(within(list).getByText('Sin datos fiscales')).toBeInTheDocument();
  });

  it('"Cargar factura" desde la tarjeta lleva a facturas con el proveedor elegido', async () => {
    sb.mock.respond('suppliers', { data: suppliers, count: 2 });
    renderWithQuery(<SuppliersPage />);
    await screen.findAllByText('InsumosPro');
    const list = screen.getAllByRole('list')[0];
    await userEvent.click(within(list).getByRole('button', { name: 'Cargar factura de Riego SRL' }));
    expect(router.push).toHaveBeenCalledWith('/invoices?supplierId=s2&supplierName=Riego%20SRL');
  });

  it('sin proveedores muestra el estado vacío fuera de la tabla', async () => {
    renderWithQuery(<SuppliersPage />);
    expect(await screen.findByText('Todavía no cargaste proveedores')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });
});
