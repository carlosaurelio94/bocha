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
vi.mock('@/context/CompanyContext', () => ({ useCompany: () => ({ current: { id: 'co1', name: 'Test' } }) }));

import { CsvImportModal, type ImportEntity } from './CsvImportModal';

const csvFile = (content: string, name = 'datos.csv') => new File([content], name, { type: 'text/csv' });

function setup(entity: ImportEntity = 'clients') {
  const onClose = vi.fn();
  const onImported = vi.fn();
  const utils = renderWithQuery(<CsvImportModal entity={entity} open onClose={onClose} onImported={onImported} />);
  return { ...utils, onClose, onImported };
}

const upload = (content: string, name?: string) =>
  userEvent.upload(screen.getByLabelText('Archivo CSV'), csvFile(content, name));

const inserts = (table: string) =>
  sb.mock.queries.filter((q) => q.table === table && q.ops[0]?.[0] === 'insert').map((q) => q.ops[0][1][0]);

beforeEach(() => {
  sb.mock.reset();
  localStorage.setItem('device_id', 'device_test');
  URL.createObjectURL = vi.fn(() => 'blob:x');
  URL.revokeObjectURL = vi.fn();
});

describe('CsvImportModal', () => {
  it('muestra los requisitos del archivo y las columnas con su ejemplo', () => {
    setup();
    expect(screen.getByRole('dialog', { name: 'Importar clientes' })).toBeInTheDocument();
    expect(screen.getByText('.csv en UTF-8')).toBeInTheDocument();
    expect(screen.getByText('Jardines del Este C.A.')).toBeInTheDocument();
    expect(screen.getByText(/No se aceptan dos filas con el mismo RIF/)).toBeInTheDocument();
  });

  it('descarga una plantilla CSV', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    setup();
    await userEvent.click(screen.getByRole('button', { name: /Descargar plantilla/ }));
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    click.mockRestore();
  });

  it('rechaza archivos que no son .csv o pesan más de 1 MB', async () => {
    setup();
    await userEvent.upload(screen.getByLabelText('Archivo CSV'), new File(['x'], 'clientes.xlsx'), { applyAccept: false });
    expect(await screen.findByRole('alert')).toHaveTextContent(/no es un archivo \.csv/);

    await upload('nombre\n' + 'x'.repeat(1024 * 1024 + 10));
    expect(await screen.findByRole('alert')).toHaveTextContent(/máximo es 1 MB/);
    expect(sb.mock.queries).toHaveLength(0);
  });

  it('un archivo válido se importa y avisa el resultado', async () => {
    const { onImported } = setup();
    await upload('nombre;rif;estado\nAna Torres;J-1;cliente\nPedro;;');

    expect(await screen.findByText(/Todo en orden: 2 clientes listos para importar/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Importar 2 clientes' }));

    expect(await screen.findByText('Se importaron 2 clientes.')).toBeInTheDocument();
    expect(inserts('clients')[0]).toEqual([
      { name: 'Ana Torres', rif: 'J-1', phone: null, address: null, client_status: 'client', created_by: 'device_test' },
      { name: 'Pedro', rif: null, phone: null, address: null, client_status: 'prospect', created_by: 'device_test' },
    ]);
    expect(onImported).toHaveBeenCalled();
  });

  it('con errores por fila no importa nada salvo que elijas "solo las válidas"', async () => {
    setup();
    await upload('nombre,telefono\nAna,0414-555-0101\nX,abc\nPedro,');

    expect(await screen.findByText(/2 problemas en 1 fila/)).toBeInTheDocument();
    expect(screen.getAllByText('telefono').length).toBeGreaterThan(0);
    const importBtn = screen.getByRole('button', { name: 'Importar 2 clientes' });
    expect(importBtn).toBeDisabled();

    await userEvent.click(screen.getByLabelText(/Importar solo las filas válidas/));
    expect(importBtn).toBeEnabled();
    await userEvent.click(importBtn);

    await screen.findByText('Se importaron 2 clientes.');
    expect((inserts('clients')[0] as { name: string }[]).map((r) => r.name)).toEqual(['Ana', 'Pedro']);
  });

  it('si el archivo no cumple los requisitos se bloquea sin opción de importar', async () => {
    setup();
    await upload('nombre,email\nAna,a@b.c');
    expect(await screen.findByText('El archivo no cumple los requisitos')).toBeInTheDocument();
    expect(screen.getByText(/Columna desconocida "email"/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Importar solo las filas válidas/)).toBeNull();
    expect(screen.getByRole('button', { name: /^Importar/ })).toBeDisabled();
  });

  it('valida contra lo que ya existe y contra el límite del plan', async () => {
    sb.mock.respond('clients', { data: [{ name: 'Ana', rif: 'J-1' }] });
    sb.mock.rpcRespond('company_limit', { data: 2 });
    setup();
    await upload('nombre,rif\nAna Bis,j-1\nPedro,\nLuis,');

    expect(await screen.findByText(/Tu plan permite 1 cliente más y el archivo tiene 2/)).toBeInTheDocument();
    expect(screen.getByText(/Ya tenés un cliente con el RIF j-1/)).toBeInTheDocument();
    expect(sb.mock.client.rpc).toHaveBeenCalledWith('company_limit', { p_company: 'co1', p_field: 'max_clients' });
  });

  it('"Elegir otro archivo" vuelve al inicio', async () => {
    setup();
    await upload('nombre,email\nAna,x');
    await userEvent.click(await screen.findByRole('button', { name: 'Elegir otro archivo' }));
    expect(screen.getByRole('button', { name: /Elegir archivo/ })).toBeInTheDocument();
  });

  it('si la base rechaza un bloque lo informa sin perder lo demás', async () => {
    setup();
    await upload('nombre\nAna\nPedro');
    await screen.findByText(/Todo en orden/);
    sb.mock.respond('clients', { error: { code: 'P0001', message: 'plan_limit:max_clients:25' } });
    await userEvent.click(screen.getByRole('button', { name: 'Importar 2 clientes' }));

    expect(await screen.findByText('No se importó nada.')).toBeInTheDocument();
    expect(screen.getAllByText(/Llegaste al límite de tu plan \(25 clientes\)/)).toHaveLength(2);
  });

  it('presupuestos: agrupa ítems, crea cabecera + ítems y cuenta presupuestos', async () => {
    sb.mock.respond('clients', { data: [{ id: 'c1', name: 'Ana Torres', rif: 'J-111' }] });
    setup('quotes');
    await upload(
      'numero,cliente,fecha,producto,cantidad,precio_unitario\n' +
      '10,J-111,15/10/2026,Ficus,2,10\n' +
      '10,J-111,15/10/2026,Palma,1,5\n' +
      '11,Ana Torres,16/10/2026,Riego,1,"1.500,00"'
    );
    await screen.findByText(/Todo en orden: 2 presupuestos listos/);

    sb.mock.respond('quotes', { data: { id: 'q10', quote_number: 10 } });
    sb.mock.respond('quotes', { data: { id: 'q11', quote_number: 11 } });
    await userEvent.click(screen.getByRole('button', { name: 'Importar 2 presupuestos' }));

    expect(await screen.findByText('Se importaron 2 presupuestos.')).toBeInTheDocument();
    const headers = inserts('quotes') as { quote_number: number; total_amount: number; item_count: number }[];
    expect(headers.map((h) => [h.quote_number, h.total_amount, h.item_count])).toEqual([[10, 25, 2], [11, 1500, 1]]);
    expect(inserts('quote_items')[0]).toHaveLength(2);
  });

  it('no se puede cerrar mientras importa', async () => {
    const { onClose } = setup();
    await upload('nombre\nAna');
    await screen.findByText(/Todo en orden/);
    // la inserción queda pendiente: el siguiente await no se resuelve hasta el final del test
    let release!: () => void;
    sb.mock.client.from.mockImplementationOnce(() => ({
      insert: () => new Promise((r) => { release = () => r({ error: null }); }),
    }) as never);
    await userEvent.click(screen.getByRole('button', { name: 'Importar 1 cliente' }));
    expect(await screen.findByText(/Importando 0 de 1 cliente/)).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
    release();
    await waitFor(() => expect(screen.getByText('Se importaron 1 cliente.')).toBeInTheDocument());
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Listo' }));
    expect(onClose).toHaveBeenCalled();
  });
});
