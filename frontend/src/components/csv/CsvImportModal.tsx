'use client';

import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, ChevronDown, Download, FileUp, Upload, XCircle } from 'lucide-react';
import { useCompany } from '@/context/CompanyContext';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { cn, toCsv } from '@/lib/utils';
import { MAX_FILE_BYTES, MAX_ROWS, validateCsv, type ColumnDef, type RowError, type ValidationResult } from '@/lib/csv/engine';
import { groupQuotes, type QuoteItemImportRow } from '@/lib/csv/definitions/quotes';
import { readFileAsText } from '@/lib/csv/readFile';
import {
  IMPORTS, buildTemplate,
  loadClientsContext, loadQuotesContext, loadSuppliersContext,
  importClients, importQuotes, importSuppliers,
  type ImportOutcome,
} from '@/lib/csv/importers';

export type ImportEntity = keyof typeof IMPORTS;

const NOUN: Record<ImportEntity, [string, string]> = {
  clients:   ['cliente', 'clientes'],
  quotes:    ['presupuesto', 'presupuestos'],
  suppliers: ['proveedor', 'proveedores'],
};

/** Claves de React Query a refrescar después de importar. */
const QUERY_KEYS: Record<ImportEntity, string[]> = {
  clients:   ['clients', 'dashboard', 'command-palette'],
  quotes:    ['quotes', 'dashboard'],
  suppliers: [],
};

const MAX_ERRORS_SHOWN = 50;

type Step =
  | { name: 'select'; error?: string }
  | { name: 'validating' }
  | { name: 'review'; fileName: string; result: ValidationResult<unknown> }
  | { name: 'importing'; done: number; total: number }
  | { name: 'done'; outcome: ImportOutcome };

interface CsvImportModalProps {
  entity:      ImportEntity;
  open:        boolean;
  onClose:     () => void;
  /** Se llama después de importar al menos un registro. */
  onImported?: () => void;
}

const plural = (n: number, [one, many]: [string, string]) => `${n} ${n === 1 ? one : many}`;

function download(name: string, content: string) {
  const url  = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8;' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: name });
  link.click();
  URL.revokeObjectURL(url);
}

export function CsvImportModal({ entity, open, onClose, onImported }: CsvImportModalProps) {
  const def = IMPORTS[entity];
  const { current: company } = useCompany();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>({ name: 'select' });
  const [dragging, setDragging] = useState(false);
  const [onlyValid, setOnlyValid] = useState(false);

  const reset = () => { setStep({ name: 'select' }); setOnlyValid(false); if (inputRef.current) inputRef.current.value = ''; };
  const close = () => {
    if (step.name === 'importing') return; // no se puede cortar a mitad de la carga
    reset();
    onClose();
  };

  const loadContext = () => entity === 'clients' ? loadClientsContext(company?.id)
    : entity === 'quotes' ? loadQuotesContext(company?.id)
    : loadSuppliersContext();

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!/\.(csv|txt)$/i.test(file.name)) {
      setStep({ name: 'select', error: `"${file.name}" no es un archivo .csv. En Excel: "Guardar como" → "CSV UTF-8".` });
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setStep({ name: 'select', error: `El archivo pesa ${(file.size / 1024 / 1024).toFixed(1)} MB; el máximo es 1 MB.` });
      return;
    }
    setStep({ name: 'validating' });
    try {
      const [text, ctx] = await Promise.all([readFileAsText(file), loadContext()]);
      const result = validateCsv(text, def as never, ctx as never) as ValidationResult<unknown>;
      setOnlyValid(false);
      setStep({ name: 'review', fileName: file.name, result });
    } catch {
      setStep({ name: 'select', error: 'No pudimos leer el archivo o consultar tus datos. Probá de nuevo.' });
    }
  };

  const runImport = async (result: ValidationResult<unknown>) => {
    const progress = (done: number, total: number) => setStep({ name: 'importing', done, total });
    const total = entity === 'quotes' ? groupQuotes(result.valid as never).length : result.valid.length;
    progress(0, total);
    const outcome = entity === 'clients' ? await importClients(result.valid as never, progress)
      : entity === 'quotes' ? await importQuotes(result.valid as never, progress)
      : await importSuppliers(result.valid as never, progress);
    QUERY_KEYS[entity].forEach((key) => qc.invalidateQueries({ queryKey: [key] }));
    if (outcome.imported > 0) onImported?.();
    setStep({ name: 'done', outcome });
  };

  const downloadErrors = (errors: RowError[]) =>
    download(`errores_${entity}.csv`, toCsv([['fila', 'columna', 'problema'], ...errors.map((e) => [e.line ?? '', e.column ?? '', e.message])]));

  return (
    <Modal open={open} onClose={close} title={def.title} description={def.rowHint} size="lg">
      {step.name === 'select' && (
        <div className="flex flex-col gap-5">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); void handleFile(e.dataTransfer.files[0]); }}
            className={cn(
              'flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors',
              dragging ? 'border-green-500 bg-green-50 dark:bg-green-900/10' : 'border-gray-300 dark:border-slate-700'
            )}
          >
            <FileUp className="h-8 w-8 text-green-600" />
            <p className="text-sm text-gray-700 dark:text-slate-300">Arrastrá tu archivo .csv acá</p>
            <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()}>
              <Upload className="h-4 w-4" />
              Elegir archivo
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              aria-label="Archivo CSV"
              onChange={(e) => void handleFile(e.target.files?.[0])}
            />
          </div>

          {step.error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">{step.error}</p>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-600 dark:text-slate-400">¿Primera vez? Bajá la plantilla con ejemplos.</p>
            <Button type="button" variant="ghost" size="sm" onClick={() => download(`plantilla_${entity}.csv`, buildTemplate(entity))}>
              <Download className="h-4 w-4" />
              Descargar plantilla
            </Button>
          </div>

          <Requirements columns={def.columns as ColumnDef[]} rules={def.rules} />
        </div>
      )}

      {step.name === 'validating' && (
        <div className="flex flex-col items-center gap-3 py-10" role="status">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
          <p className="text-sm text-gray-600 dark:text-slate-400">Revisando el archivo…</p>
        </div>
      )}

      {step.name === 'review' && (
        <Review
          entity={entity}
          fileName={step.fileName}
          result={step.result}
          onlyValid={onlyValid}
          setOnlyValid={setOnlyValid}
          onBack={reset}
          onImport={() => void runImport(step.result)}
          onDownloadErrors={downloadErrors}
        />
      )}

      {step.name === 'importing' && (
        <div className="flex flex-col gap-3 py-8" role="status" aria-live="polite">
          <p className="text-sm font-medium text-gray-800 dark:text-slate-200">
            Importando {step.done} de {plural(step.total, NOUN[entity])}…
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-800">
            <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${step.total ? (step.done / step.total) * 100 : 0}%` }} />
          </div>
          <p className="text-xs text-gray-500 dark:text-slate-400">No cierres esta ventana.</p>
        </div>
      )}

      {step.name === 'done' && (
        <div className="flex flex-col gap-4">
          <div className={cn('flex items-start gap-3 rounded-xl p-4',
            step.outcome.failed.length === 0 ? 'bg-green-50 dark:bg-green-900/10' : 'bg-amber-50 dark:bg-amber-900/10')}>
            {step.outcome.imported > 0
              ? <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
              : <XCircle className="h-5 w-5 shrink-0 text-red-500" />}
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                {step.outcome.imported > 0
                  ? `Se importaron ${plural(step.outcome.imported, NOUN[entity])}.`
                  : 'No se importó nada.'}
              </p>
              {step.outcome.failed.length > 0 && (
                <p className="text-sm text-gray-600 dark:text-slate-400">{step.outcome.failed.length} con avisos o errores:</p>
              )}
            </div>
          </div>
          {step.outcome.failed.length > 0 && (
            <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
              {step.outcome.failed.map((f, i) => (
                <li key={i} className="text-gray-700 dark:text-slate-300"><span className="font-medium">{f.label}:</span> {f.message}</li>
              ))}
            </ul>
          )}
          <div className="flex justify-end">
            <Button onClick={close}>Listo</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Requirements({ columns, rules }: { columns: ColumnDef[]; rules: string[] }) {
  return (
    <details className="group rounded-xl border border-gray-200 dark:border-slate-700" open>
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-gray-900 dark:text-slate-100 [&::-webkit-details-marker]:hidden">
        Requisitos del archivo
        <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
      </summary>
      <div className="flex flex-col gap-4 border-t border-gray-200 px-4 py-4 dark:border-slate-700">
        <ul className="list-disc space-y-1 pl-5 text-sm text-gray-600 dark:text-slate-400">
          <li>Formato <strong>.csv en UTF-8</strong>, separado por coma o punto y coma. Máximo 1 MB y {MAX_ROWS} filas.</li>
          <li>La primera fila tiene que ser la de <strong>encabezados</strong>, con los nombres de abajo (no importan mayúsculas ni acentos).</li>
          <li>No se aceptan columnas que no estén en la lista.</li>
          {rules.map((r) => <li key={r}>{r}</li>)}
          <li>Si hay errores, nada se carga hasta que los corrijas (o elijas importar solo las filas válidas).</li>
        </ul>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-gray-500 dark:text-slate-400">
                <th className="py-1.5 pr-3 font-medium">Columna</th>
                <th className="py-1.5 pr-3 font-medium">Qué va</th>
                <th className="py-1.5 font-medium">Ejemplo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {columns.map((c) => (
                <tr key={c.key}>
                  <td className="whitespace-nowrap py-1.5 pr-3 font-mono text-xs text-gray-900 dark:text-slate-100">
                    {c.key}{c.required && <span className="ml-0.5 text-red-500" title="Obligatoria">*</span>}
                  </td>
                  <td className="py-1.5 pr-3 text-gray-600 dark:text-slate-400">{c.description}</td>
                  <td className="whitespace-nowrap py-1.5 font-mono text-xs text-gray-500 dark:text-slate-400">{c.example}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-gray-500 dark:text-slate-400"><span className="text-red-500">*</span> obligatoria</p>
        </div>
      </div>
    </details>
  );
}

function Review({ entity, fileName, result, onlyValid, setOnlyValid, onBack, onImport, onDownloadErrors }: {
  entity: ImportEntity;
  fileName: string;
  result: ValidationResult<unknown>;
  onlyValid: boolean;
  setOnlyValid: (v: boolean) => void;
  onBack: () => void;
  onImport: () => void;
  onDownloadErrors: (errors: RowError[]) => void;
}) {
  const { fileErrors, rowErrors, valid, totalRows } = result;
  const blocked = fileErrors.length > 0;
  const errorLines = new Set(rowErrors.map((e) => e.line)).size;
  const count = entity === 'quotes' ? groupQuotes(valid as { value: QuoteItemImportRow }[]).length : valid.length;
  const canImport = !blocked && valid.length > 0 && (rowErrors.length === 0 || onlyValid);
  const allErrors = [...fileErrors, ...rowErrors];

  return (
    <div className="flex flex-col gap-4">
      <p className="truncate text-sm text-gray-600 dark:text-slate-400">Archivo: <span className="font-medium text-gray-900 dark:text-slate-100">{fileName}</span></p>

      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Filas" value={totalRows} />
        <Stat label="Válidas" value={valid.length} tone="good" />
        <Stat label="Con errores" value={errorLines} tone={errorLines ? 'bad' : undefined} />
      </div>

      {blocked && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-900/10">
          <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-red-700 dark:text-red-400">
            <XCircle className="h-4 w-4" /> El archivo no cumple los requisitos
          </p>
          <ul className="list-disc space-y-0.5 pl-5 text-sm text-red-700 dark:text-red-300">
            {fileErrors.map((e, i) => <li key={i}>{e.message}</li>)}
          </ul>
        </div>
      )}

      {rowErrors.length > 0 && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-900/50">
          <div className="flex items-center justify-between gap-2 border-b border-amber-200 px-4 py-2.5 dark:border-amber-900/50">
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" /> {rowErrors.length} {rowErrors.length === 1 ? 'problema' : 'problemas'} en {errorLines} {errorLines === 1 ? 'fila' : 'filas'}
            </p>
            <Button type="button" variant="ghost" size="sm" onClick={() => onDownloadErrors(allErrors)}>
              <Download className="h-4 w-4" /> Descargar errores
            </Button>
          </div>
          <div className="max-h-56 overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-white text-xs text-gray-500 dark:bg-slate-900 dark:text-slate-400">
                <tr><th className="px-4 py-1.5 font-medium">Fila</th><th className="px-2 py-1.5 font-medium">Columna</th><th className="px-2 py-1.5 font-medium">Problema</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {rowErrors.slice(0, MAX_ERRORS_SHOWN).map((e, i) => (
                  <tr key={i}>
                    <td className="px-4 py-1.5 font-mono text-xs text-gray-700 dark:text-slate-300">{e.line}</td>
                    <td className="px-2 py-1.5 font-mono text-xs text-gray-700 dark:text-slate-300">{e.column ?? '—'}</td>
                    <td className="px-2 py-1.5 text-gray-700 dark:text-slate-300">{e.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rowErrors.length > MAX_ERRORS_SHOWN && (
              <p className="px-4 py-2 text-xs text-gray-500 dark:text-slate-400">
                Y {rowErrors.length - MAX_ERRORS_SHOWN} más: descargá el reporte para verlos todos.
              </p>
            )}
          </div>
        </div>
      )}

      {!blocked && rowErrors.length === 0 && (
        <p className="flex items-center gap-2 rounded-xl bg-green-50 p-4 text-sm text-green-800 dark:bg-green-900/10 dark:text-green-300">
          <CheckCircle2 className="h-5 w-5" /> Todo en orden: {plural(count, NOUN[entity])} listos para importar.
        </p>
      )}

      {!blocked && rowErrors.length > 0 && valid.length > 0 && (
        <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-slate-300">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-green-600" checked={onlyValid} onChange={(e) => setOnlyValid(e.target.checked)} />
          <span>Importar solo las filas válidas ({plural(count, NOUN[entity])}) y descartar las que tienen errores.</span>
        </label>
      )}

      <div className="flex flex-col-reverse gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end dark:border-slate-800">
        <Button type="button" variant="secondary" onClick={onBack}>Elegir otro archivo</Button>
        <Button type="button" onClick={onImport} disabled={!canImport}>
          <Upload className="h-4 w-4" />
          Importar {plural(count, NOUN[entity])}
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'good' | 'bad' }) {
  return (
    <div className="rounded-xl bg-gray-50 px-2 py-3 dark:bg-slate-800/60">
      <p className={cn('text-xl font-bold',
        tone === 'good' ? 'text-green-700 dark:text-green-400' : tone === 'bad' ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-slate-100')}>
        {value}
      </p>
      <p className="text-xs text-gray-500 dark:text-slate-400">{label}</p>
    </div>
  );
}
