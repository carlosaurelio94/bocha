import { planLimitMessage, rules, type ImportDefinition, type RowError } from '../engine';
import { normalizeText } from '../normalize';
import type { ClientStatus } from '@/types';

export type ClientColumn = 'nombre' | 'rif' | 'telefono' | 'direccion' | 'estado';

export interface ClientImportRow {
  name:          string;
  rif:           string | null;
  phone:         string | null;
  address:       string | null;
  client_status: ClientStatus;
}

export interface ClientImportContext {
  /** RIF/CUIT ya cargados (normalizados), para no duplicar. */
  existingRifs:  Set<string>;
  /** Nombres ya cargados (normalizados), para avisar duplicados sin RIF. */
  existingNames: Set<string>;
  /** Cuántos clientes más permite el plan (null = sin límite). */
  remaining:     number | null;
}

const STATUS: Record<string, ClientStatus> = {
  cliente: 'client', client: 'client',
  prospecto: 'prospect', prospect: 'prospect',
};

const RIF_RE   = /^[A-Za-z0-9.\-\s]{3,20}$/;
const PHONE_RE = /^[0-9+()\-.\s]{6,20}$/;

export const normalizeRif = (rif: string) => rif.toUpperCase().replace(/[^A-Z0-9]/g, '');

export const clientsImport: ImportDefinition<ClientColumn, ClientImportRow, ClientImportContext> = {
  entity:  'clients',
  title:   'Importar clientes',
  rowHint: 'Una fila por cliente.',
  columns: [
    { key: 'nombre',    label: 'Nombre',    required: true, aliases: ['name', 'razon_social', 'cliente'], description: 'Nombre o razón social (2 a 120 caracteres).', example: 'Jardines del Este C.A.' },
    { key: 'rif',       label: 'RIF',       aliases: ['cuit', 'rut', 'documento', 'tax_id'], description: 'RIF/CUIT/documento. No puede repetirse.', example: 'J-12345678-9' },
    { key: 'telefono',  label: 'Teléfono',  aliases: ['phone', 'celular', 'tel'], description: 'Solo números, espacios, +, -, ( ).', example: '+58 412 555 0101' },
    { key: 'direccion', label: 'Dirección', aliases: ['address', 'domicilio'], description: 'Hasta 200 caracteres.', example: 'Av. Principal, Caracas' },
    { key: 'estado',    label: 'Estado',    aliases: ['status', 'client_status', 'tipo'], description: '"cliente" o "prospecto". Si está vacío: prospecto.', example: 'cliente' },
  ],
  rules: [
    'No se aceptan dos filas con el mismo RIF, ni un RIF que ya exista en tus clientes.',
    'Sin RIF, tampoco se aceptan nombres repetidos (en el archivo o ya cargados).',
    'No se puede superar el límite de clientes de tu plan.',
  ],

  validateRow(raw, line) {
    const errors: RowError[] = [];
    if (rules.required(raw.nombre, 'nombre', line, errors)) {
      if (raw.nombre.length < 2) errors.push({ line, column: 'nombre', message: 'Mínimo 2 caracteres.' });
      rules.maxLength(raw.nombre, 120, 'nombre', line, errors);
    }
    if (raw.rif && !RIF_RE.test(raw.rif)) errors.push({ line, column: 'rif', message: 'Formato inválido: usá letras, números y guiones (3 a 20).' });
    if (raw.telefono && !PHONE_RE.test(raw.telefono)) errors.push({ line, column: 'telefono', message: 'Formato inválido: usá números y + - ( ) (6 a 20 caracteres).' });
    rules.maxLength(raw.direccion, 200, 'direccion', line, errors);
    const status = rules.oneOf(raw.estado, STATUS, ['cliente', 'prospecto'], 'estado', line, errors, 'prospect');

    if (errors.length > 0 || !status) return { errors };
    return {
      errors,
      value: {
        name:          raw.nombre,
        rif:           raw.rif || null,
        phone:         raw.telefono || null,
        address:       raw.direccion || null,
        client_status: status,
      },
    };
  },

  validateAll(rows, ctx) {
    const errors: RowError[] = [];
    const seenRif  = new Map<string, number>();
    const seenName = new Map<string, number>();

    for (const { line, value } of rows) {
      if (value.rif) {
        const rif = normalizeRif(value.rif);
        if (ctx.existingRifs.has(rif)) {
          errors.push({ line, column: 'rif', message: `Ya tenés un cliente con el RIF ${value.rif}.` });
        } else if (seenRif.has(rif)) {
          errors.push({ line, column: 'rif', message: `RIF repetido: ya está en la fila ${seenRif.get(rif)}.` });
        } else seenRif.set(rif, line);
      } else {
        const name = normalizeText(value.name);
        if (ctx.existingNames.has(name)) {
          errors.push({ line, column: 'nombre', message: `Ya tenés un cliente llamado "${value.name}". Agregá el RIF para distinguirlo.` });
        } else if (seenName.has(name)) {
          errors.push({ line, column: 'nombre', message: `Nombre repetido: ya está en la fila ${seenName.get(name)}.` });
        } else seenName.set(name, line);
      }
    }

    const ok = rows.length - new Set(errors.map((e) => e.line)).size;
    if (ctx.remaining !== null && ok > ctx.remaining) {
      errors.push({ line: null, message: planLimitMessage(ctx.remaining, ok, ['cliente', 'clientes']) });
    }
    return errors;
  },
};
