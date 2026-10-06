import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithQuery } from '@/test/render';
import { createSupabaseMock } from '@/test/supabaseMock';
import { permissionsFor, ALL_PERMISSIONS } from '@/test/permissions';

const sb = vi.hoisted(() => ({ mock: null as unknown as ReturnType<typeof createSupabaseMock> }));
vi.mock('@/lib/supabase', async () => {
  const { createSupabaseMock } = await import('@/test/supabaseMock');
  sb.mock = createSupabaseMock();
  return { supabase: sb.mock.client };
});
vi.mock('@/context/CompanyContext', () => ({ useCompany: () => ({ current: { name: 'Vivero Urbano' } }) }));
const perms = vi.hoisted(() => ({ value: null as unknown }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => perms.value }));

import DashboardPage from './page';

/** Respuestas en el orden en que el dashboard consulta. */
function respond({ clients, monthQuotes, pending, recent, total }: {
  clients: number; monthQuotes: { total_amount: number; currency: string }[];
  pending: number; recent: unknown[]; total: number;
}) {
  sb.mock.respond('clients', { count: clients });
  sb.mock.respond('quotes', { data: monthQuotes });
  sb.mock.respond('quotes', { count: pending });
  sb.mock.respond('quotes', { data: recent });
  sb.mock.respond('quotes', { count: total });
}

const recentQuote = {
  id: 'q1', quote_number: 3, quote_date: '2026-10-02', total_amount: 120, currency: '$',
  status: 'sent', client: [{ name: 'Ana Torres' }],
};

beforeEach(() => {
  sb.mock.reset();
  perms.value = permissionsFor(...ALL_PERMISSIONS);
});

describe('DashboardPage', () => {
  it('muestra métricas y suma solo lo presupuestado en USD', async () => {
    respond({
      clients: 12, pending: 4, total: 30, recent: [recentQuote],
      monthQuotes: [{ total_amount: 100, currency: '$' }, { total_amount: 50.5, currency: '$' }, { total_amount: 9999, currency: 'Bs' }],
    });
    renderWithQuery(<DashboardPage />);

    expect(await screen.findByText('$ 150,50')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument(); // presupuestos del mes
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('las métricas llevan a la lista correspondiente', async () => {
    respond({ clients: 1, pending: 2, total: 1, recent: [], monthQuotes: [] });
    renderWithQuery(<DashboardPage />);
    const pending = (await screen.findByText('Esperando respuesta')).closest('a');
    expect(pending).toHaveAttribute('href', '/quotes?estado=sent');
  });

  it('lista los últimos presupuestos con link al detalle (cliente como array o como objeto)', async () => {
    respond({ clients: 1, pending: 0, total: 1, monthQuotes: [], recent: [recentQuote] });
    renderWithQuery(<DashboardPage />);
    const row = (await screen.findByText('Ana Torres')).closest('a');
    expect(row).toHaveAttribute('href', '/quotes/q1');
  });

  it('cuenta nueva: muestra "Primeros pasos" y el estado vacío', async () => {
    respond({ clients: 0, pending: 0, total: 0, recent: [], monthQuotes: [] });
    renderWithQuery(<DashboardPage />);
    expect(await screen.findByText('Primeros pasos')).toBeInTheDocument();
    expect(screen.getByText('1 de 4')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Cargar tu primer cliente/ })).toHaveAttribute('href', '/clients?nuevo=1');
    expect(screen.getByText('Todavía no hay presupuestos')).toBeInTheDocument();
  });

  it('con datos no muestra "Primeros pasos"', async () => {
    respond({ clients: 5, pending: 0, total: 8, recent: [recentQuote], monthQuotes: [] });
    renderWithQuery(<DashboardPage />);
    await screen.findByText('Ana Torres');
    expect(screen.queryByText('Primeros pasos')).toBeNull();
  });

  it('las acciones rápidas respetan los permisos', async () => {
    perms.value = permissionsFor('dashboard:ver', 'presupuestos:ver', 'clientes:crear');
    respond({ clients: 1, pending: 0, total: 1, recent: [], monthQuotes: [] });
    renderWithQuery(<DashboardPage />);

    expect(screen.getByRole('link', { name: /Nuevo cliente/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Hacer seguimiento/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Nuevo presupuesto/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /Cargar factura/ })).toBeNull();
  });

  it('avisa si no se pudieron cargar las métricas', async () => {
    sb.mock.respond('clients', { error: new Error('down') });
    renderWithQuery(<DashboardPage />);
    expect(await screen.findByText(/No pudimos cargar las métricas/)).toBeInTheDocument();
  });
});
