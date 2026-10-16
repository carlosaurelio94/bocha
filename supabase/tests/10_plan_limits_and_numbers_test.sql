-- Tests de la migración 20261017: límites del plan y números únicos.
-- Se corre con supabase/tests/run.sh. Falla (exit != 0) si una aserción no se cumple.
\set ON_ERROR_STOP on

-- ── Fixture: empresa en plan free (2 usuarios, 25 clientes, 20 presupuestos/mes) ──
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'admin@t.internal'),
  ('00000000-0000-0000-0000-0000000000a2', 'u2@t.internal'),
  ('00000000-0000-0000-0000-0000000000a3', 'u3@t.internal');

SELECT set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
SELECT public.bootstrap_company('test-co', 'Test Co', 'admin', 'Admin', 'enterprise') AS company_id \gset

DO $$ BEGIN
  ASSERT (SELECT p.slug FROM public.companies c JOIN public.plans p ON p.id = c.plan_id
           WHERE c.slug = 'test-co') = 'free',
         'bootstrap_company debe ignorar el plan pedido y usar free';
END $$;

-- ── Clientes: 25 entran, el 26 no ──
INSERT INTO public.clients (company_id, name, client_status, created_by)
SELECT :'company_id', 'Cliente ' || g, 'client', 'test' FROM generate_series(1, 25) g;

DO $$ BEGIN
  BEGIN
    INSERT INTO public.clients (company_id, name, client_status, created_by)
    VALUES (public.current_company_id(), 'Uno de más', 'client', 'test');
    RAISE EXCEPTION 'TEST FALLÓ: se pudo crear el cliente 26 en plan free';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM = 'plan_limit:max_clients:25', 'mensaje inesperado: ' || SQLERRM;
  END;
END $$;

-- Un cliente borrado libera lugar
UPDATE public.clients SET deleted = TRUE WHERE name = 'Cliente 1';
INSERT INTO public.clients (company_id, name, client_status, created_by)
VALUES (:'company_id', 'Reemplazo', 'client', 'test');

-- ── Usuarios: admin + 1 entran, el tercero no; cambiar rol no cuenta ──
INSERT INTO public.user_companies (user_id, company_id, role_id)
SELECT '00000000-0000-0000-0000-0000000000a2', :'company_id', id FROM public.roles WHERE name = 'viewer';

DO $$ BEGIN
  BEGIN
    INSERT INTO public.user_companies (user_id, company_id, role_id)
    SELECT '00000000-0000-0000-0000-0000000000a3', public.current_company_id(), id FROM public.roles WHERE name = 'viewer';
    RAISE EXCEPTION 'TEST FALLÓ: se pudo agregar un tercer usuario en plan free';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM = 'plan_limit:max_users:2', 'mensaje inesperado: ' || SQLERRM;
  END;
END $$;

INSERT INTO public.user_companies (user_id, company_id, role_id)
SELECT '00000000-0000-0000-0000-0000000000a2', :'company_id', id FROM public.roles WHERE name = 'administrador'
ON CONFLICT (user_id, company_id) DO UPDATE SET role_id = EXCLUDED.role_id;

-- ── Presupuestos: número único por empresa y límite mensual ──
INSERT INTO public.quotes (company_id, client_id, quote_number, quote_date, created_by)
SELECT :'company_id', (SELECT id FROM public.clients WHERE name = 'Reemplazo'), 1, CURRENT_DATE, 'test';

DO $$ BEGIN
  BEGIN
    INSERT INTO public.quotes (company_id, client_id, quote_number, quote_date, created_by)
    SELECT public.current_company_id(), (SELECT id FROM public.clients WHERE name = 'Reemplazo'), 1, CURRENT_DATE, 'test';
    RAISE EXCEPTION 'TEST FALLÓ: se aceptó un número de presupuesto duplicado';
  EXCEPTION WHEN unique_violation THEN
    NULL; -- esperado: el frontend reintenta con el siguiente número
  END;
END $$;

INSERT INTO public.quotes (company_id, client_id, quote_number, quote_date, created_by)
SELECT :'company_id', (SELECT id FROM public.clients WHERE name = 'Reemplazo'), g, CURRENT_DATE, 'test'
  FROM generate_series(2, 20) g;

DO $$ BEGIN
  BEGIN
    INSERT INTO public.quotes (company_id, client_id, quote_number, quote_date, created_by)
    SELECT public.current_company_id(), (SELECT id FROM public.clients WHERE name = 'Reemplazo'), 21, CURRENT_DATE, 'test';
    RAISE EXCEPTION 'TEST FALLÓ: se pudo crear el presupuesto 21 del mes en plan free';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM = 'plan_limit:max_quotes_per_month:20', 'mensaje inesperado: ' || SQLERRM;
  END;
END $$;

-- ── Enterprise (sin límites) ──
UPDATE public.companies SET plan_id = (SELECT id FROM public.plans WHERE slug = 'enterprise') WHERE slug = 'test-co';
INSERT INTO public.quotes (company_id, client_id, quote_number, quote_date, created_by)
SELECT :'company_id', (SELECT id FROM public.clients WHERE name = 'Reemplazo'), 21, CURRENT_DATE, 'test';

\echo 'OK: todos los tests de base de datos pasaron'
