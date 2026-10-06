import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithQuery } from '@/test/render';
import { createSupabaseMock } from '@/test/supabaseMock';

const sb = vi.hoisted(() => ({ mock: null as unknown as ReturnType<typeof createSupabaseMock> }));
vi.mock('@/lib/supabase', async () => {
  const { createSupabaseMock } = await import('@/test/supabaseMock');
  sb.mock = createSupabaseMock();
  return { supabase: sb.mock.client };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const nav = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn(), back: vi.fn() },
  params: new URLSearchParams(),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => nav.router,
  useSearchParams: () => nav.params,
}));

import NewQuotePage from './page';

const clients = [
  { id: 'c1', name: 'Ana Torres', client_status: 'client' },
  { id: 'c2', name: 'Hotel Las Palmas', client_status: 'client' },
];

function setup() {
  // Orden de las consultas al montar: próximo número, clientes, textos informativos
  sb.mock.respond('quotes', { data: { quote_number: 41 } });
  sb.mock.respond('clients', { data: clients, count: 2 });
  sb.mock.respond('quote_information', { data: [] });
  return renderWithQuery(<NewQuotePage />);
}

const items = () => within(screen.getAllByRole('list')[0]).getAllByRole('listitem');
const productInputs = () => screen.getAllByPlaceholderText('Ej: Planta ornamental 40cm');
const numberInputs = (row: HTMLElement) => within(row).getAllByRole('spinbutton');

beforeEach(() => {
  sb.mock.reset();
  nav.router.push.mockClear();
  nav.params = new URLSearchParams();
  localStorage.setItem('device_id', 'device_test');
});

describe('NewQuotePage', () => {
  it('propone el siguiente número de presupuesto', async () => {
    setup();
    await waitFor(() => expect(screen.getByLabelText(/N° de presupuesto/)).toHaveValue(42));
  });

  it('carga los clientes en el selector', async () => {
    setup();
    expect(await screen.findByRole('option', { name: 'Hotel Las Palmas' })).toBeInTheDocument();
  });

  it('calcula subtotales y total en vivo', async () => {
    setup();
    const [qty, price] = numberInputs(items()[0]);
    await userEvent.clear(qty);
    await userEvent.type(qty, '3');
    await userEvent.clear(price);
    await userEvent.type(price, '2.5');

    expect(within(items()[0]).getByText('$ 7,50')).toBeInTheDocument();
    expect(screen.getByText('$ 7,50', { selector: '.text-xl' })).toBeInTheDocument();
  });

  it('Enter en el precio de la última fila agrega otra y enfoca el producto', async () => {
    setup();
    await userEvent.type(numberInputs(items()[0])[1], '10{Enter}');
    expect(items()).toHaveLength(2);
    await waitFor(() => expect(productInputs()[1]).toHaveFocus());
  });

  it('no deja borrar la única fila, pero sí cuando hay más', async () => {
    setup();
    const removeButtons = () => screen.getAllByRole('button', { name: 'Quitar ítem' });
    removeButtons().forEach((b) => expect(b).toBeDisabled());

    await userEvent.click(screen.getByRole('button', { name: /Agregar ítem/ }));
    expect(items()).toHaveLength(2);
    await userEvent.click(removeButtons().find((b) => !b.hasAttribute('disabled'))!);
    expect(items()).toHaveLength(1);
  });

  it('exige elegir un cliente y un producto antes de guardar', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Guardar presupuesto' }));
    expect(await screen.findByText('Elegí a quién le cotizás')).toBeInTheDocument();
    expect(screen.getByText('Requerido')).toBeInTheDocument();
    expect(sb.mock.queries.some((q) => q.ops[0]?.[0] === 'insert')).toBe(false);
  });

  it('importa una lista pegada reemplazando la fila vacía', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: /Pegar lista/ }));
    const dialog = screen.getByRole('dialog', { name: 'Pegar lista de ítems' });
    await userEvent.type(within(dialog).getByRole('textbox'), '2 ficus 10{Enter}1 palma areca 30');

    expect(within(dialog).getByText(/2 ítems detectados/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: /Importar 2 ítems/ }));

    expect(productInputs().map((i) => (i as HTMLInputElement).value)).toEqual(['ficus', 'palma areca']);
    expect(screen.getByText('$ 50,00', { selector: '.text-xl' })).toBeInTheDocument();
  });

  it('avisa si el texto pegado no tiene ítems válidos', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: /Pegar lista/ }));
    const dialog = screen.getByRole('dialog');
    await userEvent.type(within(dialog).getByRole('textbox'), 'cualquier cosa');
    expect(within(dialog).getByText(/No se detectaron ítems válidos/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Importar/ })).toBeDisabled();
  });

  it('guarda cabecera + ítems y abre el presupuesto creado', async () => {
    setup();
    await screen.findByRole('option', { name: 'Ana Torres' });
    await userEvent.selectOptions(screen.getAllByRole('combobox')[0], 'c1');
    await userEvent.type(productInputs()[0], 'Ficus 40cm');
    const [qty, price] = numberInputs(items()[0]);
    await userEvent.clear(qty);
    await userEvent.type(qty, '2');
    await userEvent.clear(price);
    await userEvent.type(price, '15');

    sb.mock.respond('quotes', { data: { id: 'q-new' } });
    await userEvent.click(screen.getByRole('button', { name: 'Guardar presupuesto' }));

    await waitFor(() => expect(nav.router.push).toHaveBeenCalledWith('/quotes/q-new'));
    const insert = sb.mock.queries.find((q) => q.table === 'quotes' && q.ops[0]?.[0] === 'insert')!;
    expect(insert.ops[0][1][0]).toMatchObject({
      client_id: 'c1', quote_number: 42, total_amount: 30, item_count: 1, currency: '$', status: 'draft',
    });
    const [rows] = sb.mock.lastOps('quote_items')[0][1] as [Record<string, unknown>[]];
    expect(rows).toEqual([expect.objectContaining({ product: 'Ficus 40cm', quantity: 2, unit_price: 15, quote_id: 'q-new' })]);
  });

  it('?cliente=<id> deja el cliente preseleccionado', async () => {
    nav.params = new URLSearchParams('cliente=c2');
    setup();
    await waitFor(() => expect(screen.getAllByRole('combobox')[0]).toHaveValue('c2'));
  });
});
