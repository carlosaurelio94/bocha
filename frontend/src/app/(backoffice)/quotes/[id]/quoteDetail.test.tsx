import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Suspense } from 'react';
import { renderWithQuery } from '@/test/render';
import { createSupabaseMock } from '@/test/supabaseMock';
import { permissionsFor, ALL_PERMISSIONS } from '@/test/permissions';

const sb = vi.hoisted(() => ({ mock: null as unknown as ReturnType<typeof createSupabaseMock> }));
vi.mock('@/lib/supabase', async () => {
  const { createSupabaseMock } = await import('@/test/supabaseMock');
  sb.mock = createSupabaseMock();
  return { supabase: sb.mock.client };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/context/CompanyContext', () => ({ useCompany: () => ({ current: { name: 'Vivero Urbano' } }) }));
const pdf = vi.hoisted(() => vi.fn());
vi.mock('@/lib/generateQuotePdf', () => ({ generateQuotePdf: pdf }));
const perms = vi.hoisted(() => ({ value: null as unknown }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => perms.value }));

import QuoteDetailPage from './page';

const baseQuote = {
  id: 'q1', quote_number: 7, quote_date: '2026-10-01', total_amount: 75, item_count: 2, currency: '$',
  client: { id: 'c1', name: 'Ana Torres' }, information: null,
  items: [
    { id: 'i1', product: 'Ficus', quantity: 1, unit_price: 25, total_price: 25 },
    { id: 'i2', product: 'Palma', quantity: 2, unit_price: 25, total_price: 50 },
  ],
};

async function renderDetail(status: string) {
  sb.mock.respond('quotes', { data: { ...baseQuote, status } });
  await act(async () => {
    renderWithQuery(
      <Suspense fallback={null}>
        <QuoteDetailPage params={Promise.resolve({ id: 'q1' })} />
      </Suspense>
    );
  });
  await screen.findByRole('heading', { level: 1 });
}

beforeEach(() => {
  sb.mock.reset();
  pdf.mockClear();
  perms.value = permissionsFor(...ALL_PERMISSIONS);
});

describe('QuoteDetailPage', () => {
  it('muestra cabecera, cliente, ítems y total', async () => {
    await renderDetail('draft');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Presupuesto #0007');
    expect(screen.getByRole('link', { name: 'Ana Torres' })).toHaveAttribute('href', '/clients/c1');
    expect(screen.getAllByText('Palma').length).toBeGreaterThan(0);
    expect(screen.getByText('$ 75,00')).toBeInTheDocument();
  });

  it.each([
    ['draft',    ['Marcar como enviado']],
    ['sent',     ['Lo aprobó', 'Lo rechazó']],
    ['approved', ['Volver a "enviado"']],
    ['rejected', ['Pasar a borrador']],
  ])('en estado %s sugiere: %j', async (status, actions) => {
    await renderDetail(status);
    actions.forEach((name) => expect(screen.getByRole('button', { name })).toBeInTheDocument());
  });

  it('"Lo aprobó" actualiza el estado a approved', async () => {
    await renderDetail('sent');
    await userEvent.click(screen.getByRole('button', { name: 'Lo aprobó' }));
    await waitFor(() => expect(sb.mock.queries.some((q) =>
      q.ops[0]?.[0] === 'update' && (q.ops[0][1][0] as { status?: string }).status === 'approved')).toBe(true));
  });

  it('sin permiso de edición no ofrece cambiar el estado', async () => {
    perms.value = permissionsFor('presupuestos:ver');
    await renderDetail('sent');
    expect(screen.queryByRole('button', { name: 'Lo aprobó' })).toBeNull();
  });

  it('descarga el PDF con el nombre de la empresa', async () => {
    await renderDetail('draft');
    await userEvent.click(screen.getByRole('button', { name: /Descargar PDF/ }));
    expect(pdf).toHaveBeenCalledWith(expect.objectContaining({ id: 'q1' }), 'Vivero Urbano');
  });

  it('muestra un estado claro si el presupuesto no existe', async () => {
    sb.mock.respond('quotes', { error: { message: 'not found' } });
    await act(async () => {
      renderWithQuery(<Suspense fallback={null}><QuoteDetailPage params={Promise.resolve({ id: 'nope' })} /></Suspense>);
    });
    expect(await screen.findByText('No encontramos este presupuesto')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver a presupuestos' })).toHaveAttribute('href', '/quotes');
  });
});
