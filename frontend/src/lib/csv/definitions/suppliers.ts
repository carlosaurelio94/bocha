import { rules, type ImportDefinition, type RowError } from '../engine';
import { normalizeText } from '../normalize';
import { normalizeRif } from './clients';

export type SupplierColumn = 'razon_social' | 'nombre_fantasia' | 'cuit' | 'categoria' | 'notas';

export interface SupplierImportRow {
  legal_name:   string;
  fantasy_name: string | null;
  tax_id:       string | null;
  category:     string | null;
  notes:        string | null;
}

export interface SupplierImportContext {
  existingTaxIds: Set<string>;
  existingNames:  Set<string>;
}

export const suppliersImport: ImportDefinition<SupplierColumn, SupplierImportRow, SupplierImportContext> = {
  entity:  'suppliers',
  title:   'Importar proveedores',
  rowHint: 'Una fila por proveedor.',
  columns: [
    { key: 'razon_social',    label: 'Razón social',       required: true, aliases: ['legal_name', 'nombre', 'proveedor'], description: 'Nombre legal (2 a 150 caracteres).', example: 'Insumos del Sur S.A.' },
    { key: 'nombre_fantasia', label: 'Nombre de fantasía', aliases: ['fantasy_name', 'marca'], description: 'Como lo conocés. Hasta 150 caracteres.', example: 'InsumosPro' },
    { key: 'cuit',            label: 'CUIT',               aliases: ['rif', 'tax_id', 'vat', 'rut'], description: 'CUIT/RIF/VAT. No puede repetirse.', example: '30-71234567-8' },
    { key: 'categoria',       label: 'Categoría',          aliases: ['category', 'rubro'], description: 'Hasta 60 caracteres.', example: 'Plantas' },
    { key: 'notas',           label: 'Notas',              aliases: ['notes', 'observaciones'], description: 'Hasta 1000 caracteres.', example: 'Entrega los martes' },
  ],
  rules: [
    'No se aceptan dos filas con el mismo CUIT, ni un CUIT que ya exista en tus proveedores.',
    'Sin CUIT, tampoco se aceptan razones sociales repetidas.',
  ],

  validateRow(raw, line) {
    const errors: RowError[] = [];
    if (rules.required(raw.razon_social, 'razon_social', line, errors)) {
      if (raw.razon_social.length < 2) errors.push({ line, column: 'razon_social', message: 'Mínimo 2 caracteres.' });
      rules.maxLength(raw.razon_social, 150, 'razon_social', line, errors);
    }
    rules.maxLength(raw.nombre_fantasia, 150, 'nombre_fantasia', line, errors);
    if (raw.cuit && !/^[A-Za-z0-9.\-\s]{3,20}$/.test(raw.cuit)) errors.push({ line, column: 'cuit', message: 'Formato inválido: usá letras, números y guiones (3 a 20).' });
    rules.maxLength(raw.categoria, 60, 'categoria', line, errors);
    rules.maxLength(raw.notas, 1000, 'notas', line, errors);
    if (errors.length > 0) return { errors };
    return {
      errors,
      value: {
        legal_name:   raw.razon_social,
        fantasy_name: raw.nombre_fantasia || null,
        tax_id:       raw.cuit || null,
        category:     raw.categoria || null,
        notes:        raw.notas || null,
      },
    };
  },

  validateAll(rows, ctx) {
    const errors: RowError[] = [];
    const seenTax  = new Map<string, number>();
    const seenName = new Map<string, number>();
    for (const { line, value } of rows) {
      if (value.tax_id) {
        const tax = normalizeRif(value.tax_id);
        if (ctx.existingTaxIds.has(tax)) errors.push({ line, column: 'cuit', message: `Ya tenés un proveedor con el CUIT ${value.tax_id}.` });
        else if (seenTax.has(tax)) errors.push({ line, column: 'cuit', message: `CUIT repetido: ya está en la fila ${seenTax.get(tax)}.` });
        else seenTax.set(tax, line);
      } else {
        const name = normalizeText(value.legal_name);
        if (ctx.existingNames.has(name)) errors.push({ line, column: 'razon_social', message: `Ya tenés un proveedor "${value.legal_name}". Agregá el CUIT para distinguirlo.` });
        else if (seenName.has(name)) errors.push({ line, column: 'razon_social', message: `Razón social repetida: ya está en la fila ${seenName.get(name)}.` });
        else seenName.set(name, line);
      }
    }
    return errors;
  },
};
