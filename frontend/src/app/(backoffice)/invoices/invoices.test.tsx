import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWithQuery } from '@/test/render';
import { createSupabaseMock } from '@/test/supabaseMock';

const sb = vi.hoisted(() => ({ mock: null as unknown as ReturnType<typeof createSupabaseMock> }));
vi.mock('@/lib/supabase', async () => {
  const { createSupabaseMock } = await import('@/test/supabaseMock');
  sb.mock = createSupabaseMock();
  return { supabase: sb.mock.client };
});
const nav = vi.hoisted(() => ({ params: new URLSearchParams(), router: { push: vi.fn() } }));
vi.mock('next/navigation', () => ({ useRouter: () => nav.router, useSearchParams: () => nav.params }));

import InvoicesPage from './page';

const invoice = {
  id: 'f1', invoice_number: 'A-0001', total_amount: 1500, currency: 'ARS', status_id: 1,
  due_date: '2026-10-20', installments: 1, supplier: { id: 's1', legal_name: 'Insumos S.A.', fantasy_name: 'InsumosPro' },
};

beforeEach(() => { sb.mock.reset(); nav.params = new URLSearchParams(); });

describe('InvoicesPage', () => {
  it('en mobile muestra tarjetas con proveedor, número, vencimiento y monto', async () => {
    sb.mock.respond('invoice_statuses', { data: [{ id: 1, name: 'Pendiente' }] });
    sb.mock.respond('invoices', { data: [invoice], count: 1 });
    renderWithQuery(<InvoicesPage />);

    const list = (await screen.findAllByRole('list'))[0];
    expect(await within(list).findByText('InsumosPro')).toBeInTheDocument();
    // La fecha DATE no se corre al día anterior en UTC-4
    expect(within(list).getByText('N° A-0001 · vence 20/10/2026')).toBeInTheDocument();
  });

  it('?nuevo=1 abre directamente el formulario de carga', async () => {
    nav.params = new URLSearchParams('nuevo=1');
    renderWithQuery(<InvoicesPage />);
    expect(await screen.findByText(/Nuevo comprobante|Cargar comprobante/, { selector: 'h2' })).toBeInTheDocument();
  });

  it('sin comprobantes muestra el estado vacío fuera de la tabla', async () => {
    renderWithQuery(<InvoicesPage />);
    expect(await screen.findByText('No hay comprobantes cargados')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });
});
