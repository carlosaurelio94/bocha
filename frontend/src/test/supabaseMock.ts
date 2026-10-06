import { vi } from 'vitest';

export interface QueryResult {
  data:   unknown;
  error:  unknown;
  count?: number | null;
}

export interface RecordedQuery {
  table: string;
  ops:   [method: string, args: unknown[]][];
}

/**
 * Doble de prueba del cliente de Supabase.
 * - Registra cada cadena `from(table).select(...).eq(...)…` para poder afirmar sobre ella.
 * - Al hacer `await` devuelve la siguiente respuesta encolada para esa tabla.
 */
export function createSupabaseMock() {
  const queries: RecordedQuery[] = [];
  const queues  = new Map<string, QueryResult[]>();

  const from = vi.fn((table: string) => {
    const entry: RecordedQuery = { table, ops: [] };
    queries.push(entry);

    const builder: object = new Proxy({}, {
      get(_target, prop) {
        if (prop === 'then') {
          // Sin respuesta encolada imitamos a Supabase: lista vacía, o null en .single()
          const single = entry.ops.some(([m]) => m === 'single' || m === 'maybeSingle');
          const result = queues.get(table)?.shift() ?? { data: single ? null : [], error: null, count: 0 };
          return (resolve: (v: QueryResult) => unknown, reject: (e: unknown) => unknown) =>
            Promise.resolve(result).then(resolve, reject);
        }
        return (...args: unknown[]) => {
          entry.ops.push([String(prop), args]);
          return builder;
        };
      },
    });
    return builder;
  });

  const auth = {
    getUser:           vi.fn(async () => ({ data: { user: null }, error: null })),
    signOut:           vi.fn(async () => ({ error: null })),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
  };

  return {
    client: { from, auth },
    queries,
    /** Encola la respuesta para la próxima consulta a `table`. */
    respond(table: string, result: Partial<QueryResult>) {
      const q = queues.get(table) ?? [];
      q.push({ data: null, error: null, count: null, ...result });
      queues.set(table, q);
    },
    /** Métodos llamados en la última consulta a `table`. */
    lastOps(table: string) {
      return [...queries].reverse().find((q) => q.table === table)?.ops ?? [];
    },
    reset() {
      queries.length = 0;
      queues.clear();
      from.mockClear();
    },
  };
}
