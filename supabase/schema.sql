-- ============================================================
-- Backoffice multi-tenant — Schema consolidado
-- Ejecutar en Supabase: SQL Editor → New query → Run
-- ============================================================
-- Este archivo aplica TODO de cero: tablas, RLS, roles,
-- permisos, helpers y vista de compatibilidad.
--
-- Después corré `seed.sql` para crear la primera empresa y un
-- usuario administrador. (En este proyecto eso ya fue aplicado
-- vía MCP; los archivos quedan como fuente de verdad y para
-- replicar el setup en otros ambientes.)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ────────────────────────────────────────────────────────────
-- TENANCY: companies + profiles + user_companies
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS companies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT UNIQUE NOT NULL,
  name            TEXT NOT NULL,
  legal_name      TEXT,
  tax_id          TEXT,
  logo_url        TEXT,
  primary_color   TEXT DEFAULT '#16a34a',
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  plan            TEXT NOT NULL DEFAULT 'free',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS profiles (
  id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email               TEXT NOT NULL,
  username            TEXT UNIQUE,
  display_name        TEXT,
  current_company_id  UUID REFERENCES companies(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(lower(username));

CREATE TABLE IF NOT EXISTS user_companies (
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id   UUID NOT NULL REFERENCES companies(id)  ON DELETE CASCADE,
  role_id      UUID,
  assigned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, company_id)
);
CREATE INDEX IF NOT EXISTS idx_user_companies_user    ON user_companies(user_id);
CREATE INDEX IF NOT EXISTS idx_user_companies_company ON user_companies(company_id);

-- Trigger: crear profile automáticamente al crear usuario en auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email) VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ────────────────────────────────────────────────────────────
-- HELPERS de tenancy
-- ────────────────────────────────────────────────────────────

-- Empresa activa del usuario actual (profile.current_company_id, o la
-- primera a la que pertenezca si no hay ninguna seteada).
CREATE OR REPLACE FUNCTION public.current_company_id() RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT p.current_company_id FROM public.profiles p WHERE p.id = auth.uid()),
    (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()
       ORDER BY uc.assigned_at LIMIT 1)
  );
$$;

-- ¿El usuario actual pertenece a esta empresa?
CREATE OR REPLACE FUNCTION public.is_member_of(p_company UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_companies
    WHERE user_id = auth.uid() AND company_id = p_company
  );
$$;

-- ¿El usuario actual comparte alguna empresa con este otro usuario?
-- SECURITY DEFINER a propósito: lee user_companies salteando su RLS, así la
-- política de profiles que lo usa no entra en recursión profiles → user_companies.
CREATE OR REPLACE FUNCTION public.shares_company_with(p_user UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_companies uc_target
    JOIN public.user_companies uc_self
      ON uc_self.company_id = uc_target.company_id
    WHERE uc_target.user_id = p_user
      AND uc_self.user_id   = auth.uid()
  );
$$;

-- Resolver username → email (callable por anon, usado en el login)
CREATE OR REPLACE FUNCTION public.get_email_by_username(p_username TEXT) RETURNS TEXT
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT email FROM public.profiles WHERE username = lower(p_username) LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_email_by_username TO anon;

-- ────────────────────────────────────────────────────────────
-- TABLAS DE NEGOCIO (todas con company_id)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS clients (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id    UUID NOT NULL DEFAULT public.current_company_id() REFERENCES companies(id) ON DELETE CASCADE,
    name          VARCHAR(120) NOT NULL,
    address       VARCHAR(200),
    rif           VARCHAR(20),
    phone         VARCHAR(20),
    client_status VARCHAR(20) NOT NULL DEFAULT 'prospect'
                              CHECK (client_status IN ('prospect','client')),
    created_by    VARCHAR(80) NOT NULL,
    updated_by    VARCHAR(80),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ,
    deleted       BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_clients_company       ON clients(company_id);
CREATE INDEX IF NOT EXISTS idx_clients_deleted       ON clients(deleted);
CREATE INDEX IF NOT EXISTS idx_clients_client_status ON clients(client_status);
CREATE INDEX IF NOT EXISTS idx_clients_name          ON clients(name);

CREATE TABLE IF NOT EXISTS quote_information (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id  UUID NOT NULL DEFAULT public.current_company_id() REFERENCES companies(id) ON DELETE CASCADE,
    name        VARCHAR(80) NOT NULL,
    information TEXT NOT NULL,
    created_by  VARCHAR(80) NOT NULL,
    updated_by  VARCHAR(80),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ,
    deleted     BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_quote_info_company ON quote_information(company_id);
CREATE INDEX IF NOT EXISTS idx_quote_info_deleted ON quote_information(deleted);

CREATE TABLE IF NOT EXISTS quotes (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id     UUID NOT NULL DEFAULT public.current_company_id() REFERENCES companies(id) ON DELETE CASCADE,
    client_id      UUID NOT NULL REFERENCES clients(id),
    information_id UUID REFERENCES quote_information(id),
    quote_number   INTEGER NOT NULL,
    quote_date     DATE NOT NULL,
    total_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
    item_count     INTEGER NOT NULL DEFAULT 0,
    currency       VARCHAR(5) NOT NULL DEFAULT '$',
    status         VARCHAR(20) NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft','sent','approved','rejected')),
    created_by     VARCHAR(80) NOT NULL,
    updated_by     VARCHAR(80),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ,
    deleted        BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_quotes_company   ON quotes(company_id);
CREATE INDEX IF NOT EXISTS idx_quotes_client_id ON quotes(client_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status    ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_date      ON quotes(quote_date DESC);
CREATE INDEX IF NOT EXISTS idx_quotes_deleted   ON quotes(deleted);

CREATE TABLE IF NOT EXISTS quote_items (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id     UUID NOT NULL DEFAULT public.current_company_id() REFERENCES companies(id) ON DELETE CASCADE,
    quote_id       UUID NOT NULL REFERENCES quotes(id),
    client_id      UUID NOT NULL REFERENCES clients(id),
    information_id UUID REFERENCES quote_information(id),
    quantity       INTEGER NOT NULL CHECK (quantity > 0),
    product        VARCHAR(200) NOT NULL,
    unit_price     NUMERIC(12,2) NOT NULL,
    total_price    NUMERIC(12,2) NOT NULL,
    created_by     VARCHAR(80) NOT NULL,
    updated_by     VARCHAR(80),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ,
    deleted        BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_quote_items_company  ON quote_items(company_id);
CREATE INDEX IF NOT EXISTS idx_quote_items_quote_id ON quote_items(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_items_deleted  ON quote_items(deleted);

CREATE TABLE IF NOT EXISTS suppliers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL DEFAULT public.current_company_id() REFERENCES companies(id) ON DELETE CASCADE,
  legal_name   TEXT NOT NULL,
  fantasy_name TEXT,
  tax_id       TEXT,
  category     TEXT,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_suppliers_company    ON suppliers(company_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_legal_name ON suppliers(legal_name);

CREATE TABLE IF NOT EXISTS supplier_contacts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID NOT NULL DEFAULT public.current_company_id() REFERENCES companies(id) ON DELETE CASCADE,
  supplier_id    UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  name           TEXT,
  email          TEXT,
  phone          TEXT,
  role           TEXT,
  notify_payment BOOLEAN DEFAULT false,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_supplier_contacts_sid     ON supplier_contacts(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_contacts_company ON supplier_contacts(company_id);

CREATE TABLE IF NOT EXISTS supplier_bank_accounts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID NOT NULL DEFAULT public.current_company_id() REFERENCES companies(id) ON DELETE CASCADE,
  supplier_id    UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  account_type   TEXT NOT NULL DEFAULT 'CBU',
  account_number TEXT NOT NULL,
  bank_name      TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_supplier_bank_accounts_company ON supplier_bank_accounts(company_id);

CREATE TABLE IF NOT EXISTS invoice_statuses (
  id   SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);
INSERT INTO invoice_statuses (id, name) VALUES
  (1,'En revisión'),
  (2,'Pendiente de aprobación y Cargar retenciones'),
  (3,'Cargar retenciones'),
  (4,'Pendiente de aprobación'),
  (5,'Asignar fecha de pago'),
  (6,'Pago retrasado'),
  (7,'Esperando pago'),
  (8,'Pagado'),
  (9,'Rechazado'),
  (10,'Creación'),
  (11,'Transferencia rebotada'),
  (12,'Cheque emitido'),
  (13,'Disponible para uso'),
  (14,'Aplicada'),
  (15,'Aprobado'),
  (16,'Anulado'),
  (17,'Pendiente de aprobación por Gerencia General')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS invoices (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id             UUID NOT NULL DEFAULT public.current_company_id() REFERENCES companies(id) ON DELETE CASCADE,
  supplier_id            UUID NOT NULL REFERENCES suppliers(id),
  invoice_type           TEXT NOT NULL DEFAULT 'factura',
  invoice_number         TEXT NOT NULL,
  issue_date             DATE,
  due_date               DATE,
  currency               TEXT NOT NULL DEFAULT 'ARS',
  total_amount           NUMERIC(15,2) NOT NULL DEFAULT 0,
  taxable_amount         NUMERIC(15,2),
  tax_amount             NUMERIC(15,2),
  retention_amount       NUMERIC(15,2) DEFAULT 0,
  credit_notes_amount    NUMERIC(15,2) DEFAULT 0,
  payment_method         TEXT,
  installments           INTEGER NOT NULL DEFAULT 1,
  status_id              INTEGER NOT NULL DEFAULT 1 REFERENCES invoice_statuses(id),
  sector                 TEXT,
  budget_item            TEXT,
  rejection_reason       TEXT,
  rejection_type         TEXT,
  file_url               TEXT,
  exchange_rate_official NUMERIC(12,4),
  exchange_rate_card     NUMERIC(12,4),
  original_amount        NUMERIC(15,2),
  original_currency      TEXT,
  scheduled_payment_date DATE,
  payment_date           DATE,
  imputation_date        DATE,
  created_by             UUID,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_invoices_company  ON invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_supplier ON invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status   ON invoices(status_id);

CREATE TABLE IF NOT EXISTS invoice_installments (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id             UUID NOT NULL DEFAULT public.current_company_id() REFERENCES companies(id) ON DELETE CASCADE,
  invoice_id             UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  installment_number     INTEGER NOT NULL,
  amount                 NUMERIC(15,2) NOT NULL,
  due_date               DATE,
  status_id              INTEGER NOT NULL DEFAULT 1 REFERENCES invoice_statuses(id),
  scheduled_payment_date DATE,
  payment_date           DATE,
  created_at             TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_invoice_installments_inv     ON invoice_installments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_installments_company ON invoice_installments(company_id);

CREATE TABLE IF NOT EXISTS invoice_status_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL DEFAULT public.current_company_id() REFERENCES companies(id) ON DELETE CASCADE,
  invoice_id  UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  status_id   INTEGER NOT NULL REFERENCES invoice_statuses(id),
  notes       TEXT,
  changed_by  UUID,
  changed_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_invoice_status_history_company ON invoice_status_history(company_id);

-- ────────────────────────────────────────────────────────────
-- PERMISOS Y ROLES (catálogos globales; se asignan por empresa
-- en user_companies.role_id)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS permissions (
  id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  UNIQUE(module, action)
);

INSERT INTO permissions (module, action) VALUES
  ('dashboard',     'ver'),
  ('clientes',      'ver'),  ('clientes',     'crear'), ('clientes',     'editar'), ('clientes',     'eliminar'),
  ('presupuestos',  'ver'),  ('presupuestos', 'crear'), ('presupuestos', 'editar'), ('presupuestos', 'eliminar'), ('presupuestos','exportar'),
  ('proveedores',   'ver'),  ('proveedores',  'crear'), ('proveedores',  'editar'), ('proveedores',  'eliminar'),
  ('facturas',      'ver'),  ('facturas',     'crear'), ('facturas',     'editar'), ('facturas',     'aprobar'),  ('facturas','pagar'),
  ('configuracion', 'ver'),  ('configuracion','editar'),
  ('admin',         'ver'),  ('admin',        'editar')
ON CONFLICT (module, action) DO NOTHING;

CREATE TABLE IF NOT EXISTS roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO roles (name, description) VALUES
  ('administrador',        'Acceso total a todos los módulos de la empresa'),
  ('usuario_clientes',     'Solo módulo de clientes'),
  ('usuario_presupuestos', 'Solo módulo de presupuestos'),
  ('usuario_facturas',     'Solo módulos de proveedores y facturas'),
  ('viewer',               'Lectura en todos los módulos')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       UUID REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.name='administrador'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name='usuario_clientes'
  AND ( (p.module='dashboard' AND p.action='ver') OR p.module='clientes' )
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name='usuario_presupuestos'
  AND ( (p.module='dashboard' AND p.action='ver') OR p.module='presupuestos' )
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name='usuario_facturas'
  AND ( (p.module='dashboard' AND p.action='ver') OR p.module IN ('proveedores','facturas') )
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name='viewer' AND p.action='ver' AND p.module<>'admin'
ON CONFLICT DO NOTHING;

ALTER TABLE user_companies
  DROP CONSTRAINT IF EXISTS user_companies_role_fk;
ALTER TABLE user_companies
  ADD CONSTRAINT user_companies_role_fk
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.has_permission(p_module TEXT, p_action TEXT) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_companies uc
    JOIN public.role_permissions rp ON rp.role_id = uc.role_id
    JOIN public.permissions       p ON p.id      = rp.permission_id
    WHERE uc.user_id = auth.uid()
      AND uc.company_id = public.current_company_id()
      AND p.module = p_module
      AND p.action = p_action
  );
$$;

-- ────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ────────────────────────────────────────────────────────────

ALTER TABLE companies                ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_companies           ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions              ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_information        ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items              ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers                ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_contacts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_bank_accounts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_statuses         ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_installments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_status_history   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS companies_select ON companies;
DROP POLICY IF EXISTS companies_update ON companies;
CREATE POLICY companies_select ON companies FOR SELECT TO authenticated USING (public.is_member_of(id));
CREATE POLICY companies_update ON companies FOR UPDATE TO authenticated USING (public.is_member_of(id)) WITH CHECK (public.is_member_of(id));

DROP POLICY IF EXISTS profiles_select     ON profiles;
DROP POLICY IF EXISTS profiles_update_own ON profiles;
DROP POLICY IF EXISTS profiles_insert     ON profiles;
-- Un usuario ve su propio perfil y el de quienes comparten empresa con él.
-- Antes era USING (true): cualquier autenticado leía los perfiles (nombre, username,
-- email) de TODOS los tenants, y /admin los renderizaba en pantalla.
CREATE POLICY profiles_select     ON profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.shares_company_with(id));
CREATE POLICY profiles_update_own ON profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY profiles_insert     ON profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS uc_select_self         ON user_companies;
DROP POLICY IF EXISTS uc_select_same_company ON user_companies;
CREATE POLICY uc_select_self         ON user_companies FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY uc_select_same_company ON user_companies FOR SELECT TO authenticated USING (public.is_member_of(company_id));

DROP POLICY IF EXISTS roles_select            ON roles;
DROP POLICY IF EXISTS permissions_select      ON permissions;
DROP POLICY IF EXISTS role_permissions_select ON role_permissions;
DROP POLICY IF EXISTS invoice_statuses_select ON invoice_statuses;
CREATE POLICY roles_select            ON roles            FOR SELECT TO authenticated USING (true);
CREATE POLICY permissions_select      ON permissions      FOR SELECT TO authenticated USING (true);
CREATE POLICY role_permissions_select ON role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY invoice_statuses_select ON invoice_statuses FOR SELECT TO authenticated USING (true);

-- Tablas de negocio: filtro por empresa
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'clients','quote_information','quotes','quote_items',
    'suppliers','supplier_contacts','supplier_bank_accounts',
    'invoices','invoice_installments','invoice_status_history'
  ]) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_all ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_all ON public.%I FOR ALL TO authenticated USING (public.is_member_of(company_id)) WITH CHECK (public.is_member_of(company_id))',
      t, t
    );
  END LOOP;
END $$;

-- ────────────────────────────────────────────────────────────
-- VISTA DE COMPATIBILIDAD: user_roles (legacy)
-- El frontend antiguo consultaba `user_roles`. Acá la mapeamos
-- a user_companies filtrado por empresa activa, e instalamos
-- triggers INSTEAD OF para que INSERT/DELETE sigan funcionando.
-- ────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS public.user_roles;
CREATE VIEW public.user_roles WITH (security_invoker = true) AS
SELECT uc.user_id, uc.role_id, uc.assigned_at
FROM public.user_companies uc
WHERE uc.company_id = public.current_company_id();

GRANT SELECT, INSERT, DELETE ON public.user_roles TO authenticated;

CREATE OR REPLACE FUNCTION public.user_roles_insert_trg() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_company_id UUID;
BEGIN
  v_company_id := public.current_company_id();
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'No hay empresa activa para el usuario %', auth.uid();
  END IF;

  INSERT INTO public.user_companies (user_id, company_id, role_id)
  VALUES (NEW.user_id, v_company_id, NEW.role_id)
  ON CONFLICT (user_id, company_id)
  DO UPDATE SET role_id = EXCLUDED.role_id;

  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.user_roles_delete_trg() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_company_id UUID;
BEGIN
  v_company_id := public.current_company_id();
  DELETE FROM public.user_companies
  WHERE user_id = OLD.user_id
    AND company_id = v_company_id
    AND role_id = OLD.role_id;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS user_roles_insert ON public.user_roles;
DROP TRIGGER IF EXISTS user_roles_delete ON public.user_roles;
CREATE TRIGGER user_roles_insert INSTEAD OF INSERT ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.user_roles_insert_trg();
CREATE TRIGGER user_roles_delete INSTEAD OF DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.user_roles_delete_trg();

-- ────────────────────────────────────────────────────────────
-- SUPER ADMIN: rol cross-tenant para el operador del SaaS
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.is_super_admin() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()),
    FALSE
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

-- companies: super admin acceso total + miembros leen/editan su empresa
DROP POLICY IF EXISTS companies_select         ON public.companies;
DROP POLICY IF EXISTS companies_update         ON public.companies;
DROP POLICY IF EXISTS companies_super_all      ON public.companies;
DROP POLICY IF EXISTS companies_select_member  ON public.companies;
DROP POLICY IF EXISTS companies_update_member  ON public.companies;
CREATE POLICY companies_super_all ON public.companies
  FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY companies_select_member ON public.companies
  FOR SELECT TO authenticated USING (public.is_member_of(id));
CREATE POLICY companies_update_member ON public.companies
  FOR UPDATE TO authenticated USING (public.is_member_of(id)) WITH CHECK (public.is_member_of(id));

DROP POLICY IF EXISTS uc_super_all       ON public.user_companies;
CREATE POLICY uc_super_all ON public.user_companies
  FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS profiles_super_all ON public.profiles;
CREATE POLICY profiles_super_all ON public.profiles
  FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- ────────────────────────────────────────────────────────────
-- PLANES (catálogo público, límites por plan)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.plans (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                   TEXT UNIQUE NOT NULL,
  name                   TEXT NOT NULL,
  description            TEXT,
  price_monthly_ars      NUMERIC(12,2) NOT NULL DEFAULT 0,
  price_monthly_usd      NUMERIC(12,2) NOT NULL DEFAULT 0,
  max_users              INTEGER,
  max_clients            INTEGER,
  max_quotes_per_month   INTEGER,
  max_invoices_per_month INTEGER,
  features               JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_public              BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order             INTEGER NOT NULL DEFAULT 0,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.plans (slug, name, description, price_monthly_ars, price_monthly_usd,
                          max_users, max_clients, max_quotes_per_month, max_invoices_per_month, features, sort_order)
VALUES
  ('free',       'Free',       'Para probar la herramienta',
   0, 0, 2, 25, 20, 10,
   '{"export_pdf":true, "dark_mode":true, "branding_custom":false}'::jsonb, 1),
  ('pro',        'Pro',        'Equipos chicos en operación diaria',
   25000, 25, 10, 500, 500, 200,
   '{"export_pdf":true, "dark_mode":true, "branding_custom":true, "priority_support":false}'::jsonb, 2),
  ('enterprise', 'Enterprise', 'Sin límites, soporte prioritario',
   80000, 80, NULL, NULL, NULL, NULL,
   '{"export_pdf":true, "dark_mode":true, "branding_custom":true, "priority_support":true, "sla":true}'::jsonb, 3)
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.plans(id);

UPDATE public.companies c
   SET plan_id = p.id
  FROM public.plans p
 WHERE c.plan_id IS NULL AND p.slug = c.plan;

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS plans_public_select ON public.plans;
DROP POLICY IF EXISTS plans_super_all     ON public.plans;
CREATE POLICY plans_public_select ON public.plans FOR SELECT TO anon, authenticated USING (is_public = TRUE);
CREATE POLICY plans_super_all     ON public.plans FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE OR REPLACE FUNCTION public.company_limit(p_company UUID, p_field TEXT) RETURNS INTEGER
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE p_field
    WHEN 'max_users'              THEN p.max_users
    WHEN 'max_clients'            THEN p.max_clients
    WHEN 'max_quotes_per_month'   THEN p.max_quotes_per_month
    WHEN 'max_invoices_per_month' THEN p.max_invoices_per_month
    ELSE NULL
  END
  FROM public.companies c
  LEFT JOIN public.plans p ON p.id = c.plan_id
  WHERE c.id = p_company;
$$;
GRANT EXECUTE ON FUNCTION public.company_limit(UUID, TEXT) TO authenticated;

-- ────────────────────────────────────────────────────────────
-- SIGNUP SELF-SERVICE: RPC + helpers de disponibilidad
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_company_slug_available(p_slug TEXT) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.companies WHERE slug = lower(p_slug));
$$;
GRANT EXECUTE ON FUNCTION public.is_company_slug_available(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_username_available(p_username TEXT) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.profiles WHERE username = lower(p_username));
$$;
GRANT EXECUTE ON FUNCTION public.is_username_available(TEXT) TO anon, authenticated;

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

  SELECT id INTO v_plan_id FROM public.plans WHERE slug = COALESCE(p_plan_slug, 'free');

  INSERT INTO public.companies (slug, name, plan, plan_id)
  VALUES (lower(p_slug), p_company_name, COALESCE(p_plan_slug, 'free'), v_plan_id)
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

-- ────────────────────────────────────────────────────────────
-- BRANDING público (para el login con ?company=slug)
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_company_branding(p_slug TEXT)
RETURNS TABLE(name TEXT, primary_color TEXT, logo_url TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.name, c.primary_color, c.logo_url
  FROM public.companies c
  WHERE c.slug = lower(p_slug) AND c.active = TRUE
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_company_branding(TEXT) TO anon, authenticated;

-- Hardening de funciones helper:
-- - anon nunca debe llamarlas (sólo get_email_by_username está expuesto a anon)
-- - authenticated SÍ las necesita: las policies RLS las evalúan como el rol
--   que está corriendo el query, así que sin EXECUTE las policies fallan.
-- - trigger funcs y handle_new_user no se invocan via REST, los revocamos.
REVOKE EXECUTE ON FUNCTION public.current_company_id()       FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_member_of(uuid)         FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_permission(text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.current_company_id()       TO authenticated;
GRANT  EXECUTE ON FUNCTION public.is_member_of(uuid)         TO authenticated;
GRANT  EXECUTE ON FUNCTION public.has_permission(text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.user_roles_insert_trg()    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.user_roles_delete_trg()    FROM PUBLIC, anon, authenticated;
