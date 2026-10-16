-- Hardening (aviso del Security Advisor de Supabase): estas funciones
-- SECURITY DEFINER no tienen por qué poder llamarse sin sesión.
--  - bootstrap_company: el alta la llama la API ya autenticada como el usuario nuevo.
--  - company_limit: solo la usa el trigger enforce_plan_limit (corre como definer);
--    con anon, cualquiera podía consultar los límites de cualquier empresa por id.
-- Es idempotente.
REVOKE EXECUTE ON FUNCTION public.bootstrap_company(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.company_limit(UUID, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.bootstrap_company(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.company_limit(UUID, TEXT) TO authenticated;
