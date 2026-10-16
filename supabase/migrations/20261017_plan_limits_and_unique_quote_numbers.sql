-- ════════════════════════════════════════════════════════════════════════════
-- 1) Límites del plan aplicados en la base de datos
-- 2) Número de presupuesto único por empresa
--
-- Aplicar en Supabase: SQL Editor → pegar y ejecutar. Es idempotente.
-- ════════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────
-- 1) LÍMITES DEL PLAN
-- Antes solo se mostraban en "Plan y facturación". Ahora un INSERT que supera
-- el límite falla con el mensaje 'plan_limit:<recurso>:<límite>', que el
-- frontend traduce a un aviso con el CTA para mejorar el plan.
-- NULL en el plan = sin límite. El super-admin no tiene límites.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.enforce_plan_limit() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_field  TEXT;
  v_limit  INTEGER;
  v_used   BIGINT;
  v_month  TIMESTAMPTZ := date_trunc('month', NOW());
BEGIN
  IF public.is_super_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'clients' THEN
    v_field := 'max_clients';
  ELSIF TG_TABLE_NAME = 'quotes' THEN
    v_field := 'max_quotes_per_month';
  ELSIF TG_TABLE_NAME = 'invoices' THEN
    v_field := 'max_invoices_per_month';
  ELSIF TG_TABLE_NAME = 'user_companies' THEN
    -- Cambiar el rol de alguien que ya es miembro no suma usuarios
    IF EXISTS (SELECT 1 FROM public.user_companies
               WHERE user_id = NEW.user_id AND company_id = NEW.company_id) THEN
      RETURN NEW;
    END IF;
    v_field := 'max_users';
  ELSE
    RETURN NEW;
  END IF;

  v_limit := public.company_limit(NEW.company_id, v_field);
  IF v_limit IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'clients' THEN
    SELECT count(*) INTO v_used FROM public.clients
     WHERE company_id = NEW.company_id AND deleted = FALSE;
  ELSIF TG_TABLE_NAME = 'quotes' THEN
    SELECT count(*) INTO v_used FROM public.quotes
     WHERE company_id = NEW.company_id AND created_at >= v_month;
  ELSIF TG_TABLE_NAME = 'invoices' THEN
    SELECT count(*) INTO v_used FROM public.invoices
     WHERE company_id = NEW.company_id AND created_at >= v_month;
  ELSE
    SELECT count(*) INTO v_used FROM public.user_companies
     WHERE company_id = NEW.company_id;
  END IF;

  IF v_used >= v_limit THEN
    RAISE EXCEPTION 'plan_limit:%:%', v_field, v_limit
      USING ERRCODE = 'P0001',
            HINT    = 'Mejorá el plan desde Plan y facturación.';
  END IF;

  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.enforce_plan_limit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_plan_limit_clients        ON public.clients;
DROP TRIGGER IF EXISTS trg_plan_limit_quotes         ON public.quotes;
DROP TRIGGER IF EXISTS trg_plan_limit_invoices       ON public.invoices;
DROP TRIGGER IF EXISTS trg_plan_limit_user_companies ON public.user_companies;

CREATE TRIGGER trg_plan_limit_clients        BEFORE INSERT ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_limit();
CREATE TRIGGER trg_plan_limit_quotes         BEFORE INSERT ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_limit();
CREATE TRIGGER trg_plan_limit_invoices       BEFORE INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_limit();
CREATE TRIGGER trg_plan_limit_user_companies BEFORE INSERT ON public.user_companies
  FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_limit();

-- ────────────────────────────────────────────────────────────
-- 2) NÚMERO DE PRESUPUESTO ÚNICO POR EMPRESA
-- El siguiente número se calcula en el cliente; dos usuarios creando a la vez
-- podían obtener el mismo. El índice lo impide y el frontend reintenta con el
-- siguiente número disponible (error 23505).
-- Si ya hay duplicados, NO se crea el índice y se listan para corregirlos a mano.
-- ────────────────────────────────────────────────────────────

DO $$
DECLARE
  dup RECORD;
  has_dups BOOLEAN := FALSE;
BEGIN
  FOR dup IN
    SELECT company_id, quote_number, count(*) AS n
      FROM public.quotes
     GROUP BY company_id, quote_number
    HAVING count(*) > 1
  LOOP
    has_dups := TRUE;
    RAISE NOTICE 'Duplicado: empresa % presupuesto #% (% veces)', dup.company_id, dup.quote_number, dup.n;
  END LOOP;

  IF has_dups THEN
    RAISE WARNING 'Hay números de presupuesto duplicados: corregilos y volvé a correr esta migración.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS uq_quotes_company_number ON public.quotes(company_id, quote_number);
  END IF;
END $$;
