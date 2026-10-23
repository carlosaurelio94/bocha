import { describe, it, expect } from 'vitest';
import { validateCsv, MAX_ROWS } from './engine';
import { clientsImport, type ClientImportContext } from './definitions/clients';
import { suppliersImport } from './definitions/suppliers';
import { quotesImport, groupQuotes, type QuoteImportContext } from './definitions/quotes';
import { buildTemplate, IMPORTS } from './importers';

const clientsCtx = (over: Partial<ClientImportContext> = {}): ClientImportContext =>
  ({ existingRifs: new Set(), existingNames: new Set(), remaining: null, ...over });

const messages = (r: { rowErrors: { message: string }[]; fileErrors: { message: string }[] }) =>
  [...r.fileErrors, ...r.rowErrors].map((e) => e.message).join(' | ');

describe('criterios del archivo', () => {
  it('rechaza columnas desconocidas y avisa cuáles son válidas', () => {
    const r = validateCsv('nombre,email\nAna,a@b.c', clientsImport, clientsCtx());
    expect(r.fileErrors[0].message).toMatch(/Columna desconocida "email".*nombre, rif/);
    expect(r.valid).toHaveLength(0);
  });

  it('exige las columnas obligatorias', () => {
    const r = validateCsv('rif\nJ-1', clientsImport, clientsCtx());
    expect(messages(r)).toMatch(/Falta la columna obligatoria "nombre"/);
  });

  it('acepta encabezados con mayúsculas, acentos y alias', () => {
    const r = validateCsv('Nombre;Teléfono;CUIT;Estado\nAna;0414 555;J-1;Cliente', clientsImport, clientsCtx());
    expect(r.fileErrors).toEqual([]);
    expect(r.valid[0].value).toMatchObject({ name: 'Ana', phone: '0414 555', rif: 'J-1', client_status: 'client' });
  });

  it('rechaza columnas repetidas', () => {
    expect(messages(validateCsv('nombre,name\nA,B', clientsImport, clientsCtx()))).toMatch(/repetida/);
  });

  it('rechaza archivos sin filas, demasiado grandes o que no son UTF-8', () => {
    expect(messages(validateCsv('nombre\n', clientsImport, clientsCtx()))).toMatch(/no tiene filas/);
    const big = 'nombre\n' + Array.from({ length: MAX_ROWS + 1 }, (_, i) => `Cliente ${i}`).join('\n');
    expect(messages(validateCsv(big, clientsImport, clientsCtx()))).toMatch(/máximo por importación es 1000/);
    expect(messages(validateCsv('nombre\nJos�', clientsImport, clientsCtx()))).toMatch(/UTF-8/);
  });

  it('detecta filas con más valores que columnas (comas sin comillas)', () => {
    const r = validateCsv('nombre,rif\nJardines, C.A.,J-1', clientsImport, clientsCtx());
    expect(r.rowErrors[0]).toMatchObject({ line: 2 });
    expect(r.rowErrors[0].message).toMatch(/3 valores pero hay 2 columnas/);
  });

  it('las plantillas descargables pasan su propia validación', () => {
    const ctxs = {
      clients: clientsCtx(),
      suppliers: { existingTaxIds: new Set<string>(), existingNames: new Set<string>() },
      quotes: { clients: [{ id: 'c1', name: 'María López', rif: null }, { id: 'c2', name: 'Jardines', rif: 'J-12345678-9' }], existingNumbers: new Set<number>(), remainingThisMonth: null },
    };
    (Object.keys(IMPORTS) as (keyof typeof IMPORTS)[]).forEach((entity) => {
      const r = validateCsv(buildTemplate(entity), IMPORTS[entity] as never, ctxs[entity] as never);
      expect({ entity, errors: messages(r) }).toEqual({ entity, errors: '' });
      expect(r.valid.length).toBeGreaterThan(0);
    });
  });
});

describe('clientes', () => {
  it('valida cada campo con la fila y columna del error', () => {
    const csv = 'nombre,rif,telefono,estado\nA,J-1,0414,vip\n,,,\nOk,J#1,+58 (412) 555-01,';
    const r = validateCsv(csv, clientsImport, clientsCtx());
    expect(r.rowErrors).toEqual(expect.arrayContaining([
      expect.objectContaining({ line: 2, column: 'nombre', message: 'Mínimo 2 caracteres.' }),
      expect.objectContaining({ line: 2, column: 'telefono' }),
      expect.objectContaining({ line: 2, column: 'estado', message: '"vip" no es válido. Usá cliente o prospecto.' }),
      expect.objectContaining({ line: 4, column: 'rif' }),
    ]));
  });

  it('el estado vacío es prospecto', () => {
    expect(validateCsv('nombre\nAna', clientsImport, clientsCtx()).valid[0].value.client_status).toBe('prospect');
  });

  it('no duplica RIF (en el archivo ni con los ya cargados, ignorando guiones)', () => {
    const r = validateCsv('nombre,rif\nA1,J-123\nA2,j123\nA3,V-9', clientsImport, clientsCtx({ existingRifs: new Set(['V9']) }));
    expect(r.valid.map((v) => v.line)).toEqual([2]);
    expect(messages(r)).toMatch(/RIF repetido: ya está en la fila 2/);
    expect(messages(r)).toMatch(/Ya tenés un cliente con el RIF V-9/);
  });

  it('sin RIF no acepta nombres repetidos', () => {
    const r = validateCsv('nombre\nJosé Pérez\njose  perez\nAna', clientsImport, clientsCtx({ existingNames: new Set(['ana']) }));
    expect(r.valid.map((v) => v.line)).toEqual([2]);
  });

  it('respeta el límite del plan bloqueando todo el archivo', () => {
    const r = validateCsv('nombre\nA1\nA2\nA3', clientsImport, clientsCtx({ remaining: 2 }));
    expect(r.fileErrors[0].message).toMatch(/permite 2 clientes más y el archivo tiene 3/);
  });

  it('lee CSV exportados por nosotros (quita el apóstrofo anti-fórmulas)', () => {
    const r = validateCsv(`nombre,telefono\nAna,'+58 412 555 0101`, clientsImport, clientsCtx());
    expect(r.valid[0].value.phone).toBe('+58 412 555 0101');
  });
});

describe('proveedores', () => {
  it('exige razón social y no duplica CUIT', () => {
    const r = validateCsv('razon_social,cuit\nInsumos,30-1\n,30-2\nOtro,301', suppliersImport,
      { existingTaxIds: new Set<string>(), existingNames: new Set<string>() });
    expect(r.valid.map((v) => v.line)).toEqual([2]);
    expect(messages(r)).toMatch(/Es obligatorio/);
    expect(messages(r)).toMatch(/CUIT repetido/);
  });
});

describe('presupuestos', () => {
  const ctx = (over: Partial<QuoteImportContext> = {}): QuoteImportContext => ({
    clients: [
      { id: 'c1', name: 'Ana Torres', rif: 'J-111' },
      { id: 'c2', name: 'Hotel Las Palmas', rif: null },
      { id: 'c3', name: 'Duplicado', rif: null },
      { id: 'c4', name: 'Duplicado', rif: null },
    ],
    existingNumbers: new Set([50]),
    remainingThisMonth: null,
    ...over,
  });
  const head = 'numero,cliente,fecha,moneda,estado,producto,cantidad,precio_unitario\n';

  it('agrupa ítems por número y calcula totales', () => {
    const r = validateCsv(head +
      '1,J111,15/10/2026,usd,enviado,Ficus,2,"10,50"\n' +
      '1,J-111,2026-10-15,$,Enviado,Palma,1,4\n' +
      '2,hotel las palmas,16/10/2026,,,Riego,3,100', quotesImport, ctx());
    expect(messages(r)).toBe('');
    const quotes = groupQuotes(r.valid);
    expect(quotes).toHaveLength(2);
    expect(quotes[0].dto).toMatchObject({ quote_number: 1, client_id: 'c1', quote_date: '2026-10-15', currency: '$', status: 'sent', total_amount: 25, item_count: 2 });
    expect(quotes[0].dto.items[0]).toMatchObject({ product: 'Ficus', quantity: 2, unit_price: 10.5, total_price: 21 });
    expect(quotes[1].dto).toMatchObject({ client_id: 'c2', currency: '$', status: 'draft' });
  });

  it('valida cliente inexistente o ambiguo, fecha, moneda, cantidad y precio', () => {
    const r = validateCsv(head +
      '1,Nadie,15/10/2026,$,,A,1,1\n' +
      '2,Duplicado,15/10/2026,$,,A,1,1\n' +
      '3,Ana Torres,31/02/2026,yen,,A,1.5,-3', quotesImport, ctx());
    const text = messages(r);
    expect(text).toMatch(/No existe el cliente "Nadie"/);
    expect(text).toMatch(/Hay 2 clientes llamados "Duplicado"\. Usá el RIF/);
    expect(text).toMatch(/Fecha inválida "31\/02\/2026"/);
    expect(text).toMatch(/Moneda "yen"/);
    expect(text).toMatch(/entero mayor a 0 \(sin decimales\)/);
    expect(text).toMatch(/Precio inválido "-3"/);
    expect(r.valid).toHaveLength(0);
  });

  it('si un ítem falla, descarta el presupuesto completo (nunca a medias)', () => {
    const r = validateCsv(head +
      '7,Ana Torres,15/10/2026,$,,Ficus,2,10\n' +
      '7,Ana Torres,15/10/2026,$,,,1,4\n' +
      '8,Ana Torres,15/10/2026,$,,Palma,1,4', quotesImport, ctx());
    expect(r.valid.map((v) => v.value.quote_number)).toEqual([8]);
    expect(r.rowErrors.find((e) => e.line === 2)?.message).toMatch(/otro ítem del presupuesto #7 tiene errores/);
  });

  it('las filas de un mismo número tienen que coincidir en cliente, fecha, moneda y estado', () => {
    const r = validateCsv(head +
      '9,Ana Torres,15/10/2026,$,,Ficus,2,10\n' +
      '9,Ana Torres,16/10/2026,Bs,,Palma,1,4', quotesImport, ctx());
    expect(r.valid).toHaveLength(0);
    expect(messages(r)).toMatch(/No coincide con la fila 2 del presupuesto #9 \(fecha, moneda\)/);
  });

  it('no permite números que ya existen', () => {
    const r = validateCsv(head + '50,Ana Torres,15/10/2026,$,,Ficus,2,10', quotesImport, ctx());
    expect(messages(r)).toMatch(/#50 ya existe/);
  });

  it('respeta el límite mensual del plan contando presupuestos, no ítems', () => {
    const csv = head + '1,Ana Torres,15/10/2026,$,,A,1,1\n1,Ana Torres,15/10/2026,$,,B,1,1\n2,Ana Torres,15/10/2026,$,,A,1,1';
    expect(validateCsv(csv, quotesImport, ctx({ remainingThisMonth: 2 })).fileErrors).toEqual([]);
    expect(validateCsv(csv, quotesImport, ctx({ remainingThisMonth: 1 })).fileErrors[0].message).toMatch(/permite 1 presupuesto más este mes y el archivo tiene 2/);
    expect(validateCsv(csv, quotesImport, ctx({ remainingThisMonth: 0 })).fileErrors[0].message).toMatch(/Llegaste al límite de presupuestos este mes/);
  });
});
