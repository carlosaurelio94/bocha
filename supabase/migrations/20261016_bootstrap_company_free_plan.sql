-- Fix de seguridad: el alta self-service ya no puede elegir plan.
-- Antes, POST /api/auth/signup con {"planSlug":"enterprise"} (o la RPC directa)
-- creaba la empresa en un plan pago sin pasar por el super-admin.
--
-- Aplicar en Supabase: SQL Editor → pegar y ejecutar. Es idempotente.

CREATE OR REPLACE FUNCTION public.bootstrap_company(
  p_slug          TEXT,
  p_company_name  TEXT,
  p_username      TEXT,
  p_display_name  TEXT,
  p_plan_slug     TEXT DEFAULT 'free'
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id    UUID := auth.uid();
  v_company_id UUID;
  v_role_id    UUID;
  v_plan_id    UUID;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'no hay sesión activa'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_companies WHERE user_id = v_user_id) THEN
    RAISE EXCEPTION 'el usuario ya pertenece a una empresa';
  END IF;
  IF NOT public.is_company_slug_available(p_slug) THEN
    RAISE EXCEPTION 'el slug % ya está en uso', p_slug;
  END IF;

  -- El alta self-service SIEMPRE arranca en 'free'. p_plan_slug se mantiene
  -- por compatibilidad pero se ignora: si no, cualquiera podía crearse una
  -- empresa en un plan pago llamando a la RPC con 'enterprise'.
  -- Los cambios de plan los hace el super-admin desde /admin/companies.
  SELECT id INTO v_plan_id FROM public.plans WHERE slug = 'free';

  INSERT INTO public.companies (slug, name, plan, plan_id)
  VALUES (lower(p_slug), p_company_name, 'free', v_plan_id)
  RETURNING id INTO v_company_id;

  SELECT id INTO v_role_id FROM public.roles WHERE name = 'administrador';

  INSERT INTO public.user_companies (user_id, company_id, role_id)
  VALUES (v_user_id, v_company_id, v_role_id);

  UPDATE public.profiles
     SET username           = lower(p_username),
         display_name       = COALESCE(p_display_name, p_username),
         current_company_id = v_company_id
   WHERE id = v_user_id;

  RETURN v_company_id;
END $$;
GRANT EXECUTE ON FUNCTION public.bootstrap_company(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
