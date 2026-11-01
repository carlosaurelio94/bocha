-- ════════════════════════════════════════════════════════════════════════════
-- Productos y stock, vendedores, ventas (consumos de clientes) y métricas.
--
-- - products: stock actual y mínimo. Al llegar al mínimo, la app avisa que
--   hay que comprar más (vista low_stock_products).
-- - sellers: quién hizo cada venta (no necesita usuario en el sistema).
-- - sales + sale_items: lo que consumió un cliente. Pendiente = "a cuenta".
-- - stock_movements: historial de cada cambio de stock.
--
-- El stock solo cambia por las RPC (register_sale, cancel_sale, adjust_stock),
-- que bloquean las filas y validan que no quede negativo.
--
-- Aplicar en Supabase: SQL Editor → pegar y ejecutar. Es idempotente.
-- ════════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────
-- PERMISOS
-- ────────────────────────────────────────────────────────────
INSERT INTO public.permissions (module, action) VALUES
  ('productos', 'ver'), ('productos', 'crear'), ('productos', 'editar'), ('productos', 'eliminar'),
  ('ventas',    'ver'), ('ventas',    'crear'), ('ventas',    'editar'), ('ventas',    'eliminar'),
  ('metricas',  'ver')
ON CONFLICT (module, action) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'administrador' AND p.module IN ('productos', 'ventas', 'metricas')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'viewer' AND p.action = 'ver' AND p.module IN ('productos', 'ventas', 'metricas')
ON CONFLICT DO NOTHING;

-- Rol para quien atiende: registra ventas, ve clientes y productos (no edita stock)
INSERT INTO public.roles (name, description)
VALUES ('usuario_ventas', 'Registrar ventas y ver clientes y productos')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'usuario_ventas'
  AND ( (p.module = 'dashboard' AND p.action = 'ver')
     OR (p.module IN ('clientes', 'productos') AND p.action = 'ver')
     OR (p.module = 'ventas' AND p.action IN ('ver', 'crear', 'editar')) )
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- TABLAS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.products (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL DEFAULT public.current_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
  name          TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  sku           TEXT CHECK (sku IS NULL OR length(sku) <= 40),
  unit          TEXT NOT NULL DEFAULT 'unidad' CHECK (length(unit) BETWEEN 1 AND 20),
  price         NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  stock_current NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (stock_current >= 0),
  stock_min     NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (stock_min >= 0),
  created_by    UUID DEFAULT auth.uid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ,
  deleted       BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_products_company ON public.products(company_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_products_company_name
  ON public.products(company_id, lower(btrim(name))) WHERE NOT deleted;

CREATE TABLE IF NOT EXISTS public.sellers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL DEFAULT public.current_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
  name       TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sellers_company ON public.sellers(company_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sellers_company_name
  ON public.sellers(company_id, lower(btrim(name)));

CREATE TABLE IF NOT EXISTS public.sales (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL DEFAULT public.current_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
  client_id  UUID REFERENCES public.clients(id),          -- NULL = venta al mostrador
  seller_id  UUID NOT NULL REFERENCES public.sellers(id),
  sale_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  total      NUMERIC(12,2) NOT NULL DEFAULT 0,
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  notes      TEXT CHECK (notes IS NULL OR length(notes) <= 500),
  paid_at    TIMESTAMPTZ,
  created_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted    BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_sales_company_date ON public.sales(company_id, sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_client       ON public.sales(client_id);
CREATE INDEX IF NOT EXISTS idx_sales_seller       ON public.sales(seller_id);

CREATE TABLE IF NOT EXISTS public.sale_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL DEFAULT public.current_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
  sale_id    UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity   NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  total      NUMERIC(12,2) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale    ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON public.sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_company ON public.sale_items(company_id);

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL DEFAULT public.current_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL CHECK (kind IN ('initial', 'purchase', 'adjustment', 'sale', 'sale_cancel')),
  quantity   NUMERIC(12,2) NOT NULL,                       -- con signo: + entra, - sale
  stock_after NUMERIC(12,2) NOT NULL,
  sale_id    UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  notes      TEXT CHECK (notes IS NULL OR length(notes) <= 200),
  created_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON public.stock_movements(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_company ON public.stock_movements(company_id);

-- ────────────────────────────────────────────────────────────
-- RLS: cada empresa ve solo lo suyo (mismo criterio que el resto)
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['products', 'sellers', 'sales', 'sale_items', 'stock_movements']) LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I_all ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_all ON public.%I FOR ALL TO authenticated USING (public.is_member_of(company_id)) WITH CHECK (public.is_member_of(company_id))',
      t, t
    );
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
  END LOOP;
END $$;

-- El stock, el total y los ítems de una venta no se tocan a mano: solo las RPC.
REVOKE INSERT, UPDATE, DELETE ON public.sale_items, public.stock_movements FROM authenticated;
REVOKE INSERT, DELETE ON public.sales FROM authenticated;
REVOKE UPDATE ON public.sales FROM authenticated;
GRANT  UPDATE (status, paid_at, notes) ON public.sales TO authenticated;
REVOKE UPDATE ON public.products FROM authenticated;
GRANT  UPDATE (name, sku, unit, price, stock_min, updated_at, deleted) ON public.products TO authenticated;

-- ────────────────────────────────────────────────────────────
-- Stock inicial: el alta de un producto deja su movimiento
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.products_initial_movement() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.stock_current > 0 THEN
    INSERT INTO public.stock_movements (company_id, product_id, kind, quantity, stock_after, notes)
    VALUES (NEW.company_id, NEW.id, 'initial', NEW.stock_current, NEW.stock_current, 'Stock inicial');
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.products_initial_movement() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE TRIGGER trg_products_initial_movement
  AFTER INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.products_initial_movement();

-- ────────────────────────────────────────────────────────────
-- Productos con stock bajo (actual <= mínimo). PostgREST no puede comparar
-- dos columnas en un filtro, por eso la vista.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.low_stock_products WITH (security_invoker = true) AS
SELECT id, company_id, name, sku, unit, stock_current, stock_min
FROM public.products
WHERE NOT deleted AND stock_current <= stock_min;

REVOKE ALL ON public.low_stock_products FROM anon;
GRANT SELECT ON public.low_stock_products TO authenticated;

-- ────────────────────────────────────────────────────────────
-- Helpers
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.require_permission(p_module TEXT, p_action TEXT) RETURNS VOID
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.current_company_id() IS NULL THEN
    RAISE EXCEPTION 'sin_empresa' USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.has_permission(p_module, p_action) OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'sin_permiso:%:%', p_module, p_action USING ERRCODE = '42501';
  END IF;
END $$;
-- Solo se usa dentro de las RPC SECURITY DEFINER (corren como owner)
REVOKE EXECUTE ON FUNCTION public.require_permission(TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- ────────────────────────────────────────────────────────────
-- register_sale: crea la venta, descuenta stock y devuelve los productos
-- que quedaron en o debajo del mínimo.
--   p_items: [{"product_id": "...", "quantity": 2}, ...]
-- Errores: venta_sin_items, demasiados_items, cantidad_invalida,
--          producto_inexistente, vendedor_invalido, cliente_invalido,
--          stock_insuficiente:<nombre>:<disponible>
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.register_sale(
  p_seller_id UUID,
  p_items     JSONB,
  p_client_id UUID DEFAULT NULL,
  p_sale_date DATE DEFAULT NULL,
  p_status    TEXT DEFAULT 'pending',
  p_notes     TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_company UUID := public.current_company_id();
  v_sale    UUID;
  v_total   NUMERIC(12,2) := 0;
  v_line    RECORD;
  v_low     JSONB;
BEGIN
  PERFORM public.require_permission('ventas', 'crear');

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'venta_sin_items' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_array_length(p_items) > 100 THEN
    RAISE EXCEPTION 'demasiados_items' USING ERRCODE = 'P0001';
  END IF;
  IF p_status NOT IN ('pending', 'paid') THEN
    RAISE EXCEPTION 'estado_invalido' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.sellers WHERE id = p_seller_id AND company_id = v_company AND active) THEN
    RAISE EXCEPTION 'vendedor_invalido' USING ERRCODE = 'P0001';
  END IF;
  IF p_client_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.clients WHERE id = p_client_id AND company_id = v_company AND NOT deleted
  ) THEN
    RAISE EXCEPTION 'cliente_invalido' USING ERRCODE = 'P0001';
  END IF;

  -- Cantidades por producto (si un producto viene en dos líneas, se suman)
  CREATE TEMP TABLE IF NOT EXISTS _sale_lines (product_id UUID PRIMARY KEY, quantity NUMERIC(12,2)) ON COMMIT DROP;
  TRUNCATE _sale_lines;
  BEGIN
    INSERT INTO _sale_lines (product_id, quantity)
    SELECT (e->>'product_id')::uuid, sum((e->>'quantity')::numeric)
    FROM jsonb_array_elements(p_items) e
    GROUP BY 1;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RAISE EXCEPTION 'cantidad_invalida' USING ERRCODE = 'P0001';
  END;

  IF EXISTS (SELECT 1 FROM _sale_lines WHERE product_id IS NULL) THEN
    RAISE EXCEPTION 'producto_inexistente' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM _sale_lines WHERE quantity IS NULL OR quantity <= 0 OR quantity <> round(quantity, 2)) THEN
    RAISE EXCEPTION 'cantidad_invalida' USING ERRCODE = 'P0001';
  END IF;

  -- Bloquear los productos en orden fijo (evita deadlocks entre ventas simultáneas)
  PERFORM 1 FROM public.products p JOIN _sale_lines l ON l.product_id = p.id
   WHERE p.company_id = v_company AND NOT p.deleted
   ORDER BY p.id FOR UPDATE OF p;

  IF (SELECT count(*) FROM public.products p JOIN _sale_lines l ON l.product_id = p.id
       WHERE p.company_id = v_company AND NOT p.deleted) <> (SELECT count(*) FROM _sale_lines) THEN
    RAISE EXCEPTION 'producto_inexistente' USING ERRCODE = 'P0001';
  END IF;

  SELECT p.name, p.stock_current INTO v_line
    FROM public.products p JOIN _sale_lines l ON l.product_id = p.id
   WHERE p.stock_current < l.quantity
   ORDER BY p.name LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'stock_insuficiente:%:%', v_line.name, v_line.stock_current USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.sales (company_id, client_id, seller_id, sale_date, status, notes, paid_at)
  VALUES (v_company, p_client_id, p_seller_id, COALESCE(p_sale_date, CURRENT_DATE), p_status,
          NULLIF(btrim(p_notes), ''), CASE WHEN p_status = 'paid' THEN NOW() END)
  RETURNING id INTO v_sale;

  INSERT INTO public.sale_items (company_id, sale_id, product_id, quantity, unit_price, total)
  SELECT v_company, v_sale, p.id, l.quantity, p.price, round(l.quantity * p.price, 2)
    FROM public.products p JOIN _sale_lines l ON l.product_id = p.id;

  SELECT COALESCE(sum(total), 0) INTO v_total FROM public.sale_items WHERE sale_id = v_sale;
  UPDATE public.sales SET total = v_total WHERE id = v_sale;

  WITH upd AS (
    UPDATE public.products p
       SET stock_current = p.stock_current - l.quantity, updated_at = NOW()
      FROM _sale_lines l
     WHERE p.id = l.product_id
    RETURNING p.id, p.company_id, l.quantity, p.stock_current
  )
  INSERT INTO public.stock_movements (company_id, product_id, kind, quantity, stock_after, sale_id)
  SELECT company_id, id, 'sale', -quantity, stock_current, v_sale FROM upd;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', p.id, 'name', p.name, 'unit', p.unit,
           'stock_current', p.stock_current, 'stock_min', p.stock_min) ORDER BY p.name), '[]'::jsonb)
    INTO v_low
    FROM public.products p JOIN _sale_lines l ON l.product_id = p.id
   WHERE p.stock_current <= p.stock_min;

  RETURN jsonb_build_object('sale_id', v_sale, 'total', v_total, 'low_stock', v_low);
END $$;
REVOKE EXECUTE ON FUNCTION public.register_sale(UUID, JSONB, UUID, DATE, TEXT, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.register_sale(UUID, JSONB, UUID, DATE, TEXT, TEXT) TO authenticated;

-- ────────────────────────────────────────────────────────────
-- cancel_sale: anula una venta y devuelve el stock
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_sale(p_sale_id UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_company UUID := public.current_company_id();
BEGIN
  PERFORM public.require_permission('ventas', 'eliminar');

  PERFORM 1 FROM public.sales WHERE id = p_sale_id AND company_id = v_company AND NOT deleted FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'venta_inexistente' USING ERRCODE = 'P0001';
  END IF;

  PERFORM 1 FROM public.products p JOIN public.sale_items i ON i.product_id = p.id
   WHERE i.sale_id = p_sale_id ORDER BY p.id FOR UPDATE OF p;

  WITH qty AS (
    SELECT product_id, sum(quantity) AS quantity FROM public.sale_items
     WHERE sale_id = p_sale_id GROUP BY product_id
  ), upd AS (
    UPDATE public.products p
       SET stock_current = p.stock_current + q.quantity, updated_at = NOW()
      FROM qty q
     WHERE p.id = q.product_id
    RETURNING p.id, p.company_id, q.quantity, p.stock_current
  )
  INSERT INTO public.stock_movements (company_id, product_id, kind, quantity, stock_after, sale_id, notes)
  SELECT company_id, id, 'sale_cancel', quantity, stock_current, p_sale_id, 'Venta anulada' FROM upd;

  UPDATE public.sales SET deleted = TRUE WHERE id = p_sale_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.cancel_sale(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.cancel_sale(UUID) TO authenticated;

-- ────────────────────────────────────────────────────────────
-- adjust_stock: compra (suma) o ajuste (suma o resta) de stock
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.adjust_stock(
  p_product_id UUID,
  p_quantity   NUMERIC,
  p_kind       TEXT DEFAULT 'purchase',
  p_notes      TEXT DEFAULT NULL
) RETURNS NUMERIC
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_company UUID := public.current_company_id();
  v_stock   NUMERIC(12,2);
BEGIN
  PERFORM public.require_permission('productos', 'editar');

  IF p_kind NOT IN ('purchase', 'adjustment') THEN
    RAISE EXCEPTION 'tipo_invalido' USING ERRCODE = 'P0001';
  END IF;
  IF p_quantity IS NULL OR p_quantity = 0 OR p_quantity <> round(p_quantity, 2)
     OR abs(p_quantity) >= 10000000000 OR (p_kind = 'purchase' AND p_quantity < 0) THEN
    RAISE EXCEPTION 'cantidad_invalida' USING ERRCODE = 'P0001';
  END IF;

  SELECT stock_current INTO v_stock FROM public.products
   WHERE id = p_product_id AND company_id = v_company AND NOT deleted FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'producto_inexistente' USING ERRCODE = 'P0001';
  END IF;
  IF v_stock + p_quantity < 0 THEN
    RAISE EXCEPTION 'stock_negativo:%', v_stock USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.products SET stock_current = v_stock + p_quantity, updated_at = NOW()
   WHERE id = p_product_id
  RETURNING stock_current INTO v_stock;

  INSERT INTO public.stock_movements (company_id, product_id, kind, quantity, stock_after, notes)
  VALUES (v_company, p_product_id, p_kind, p_quantity, v_stock, NULLIF(btrim(p_notes), ''));

  RETURN v_stock;
END $$;
REVOKE EXECUTE ON FUNCTION public.adjust_stock(UUID, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.adjust_stock(UUID, NUMERIC, TEXT, TEXT) TO authenticated;

-- ────────────────────────────────────────────────────────────
-- sales_metrics: ventas por vendedor y por producto en un rango de fechas
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sales_metrics(p_from DATE, p_to DATE) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_company UUID := public.current_company_id();
  v_result  JSONB;
BEGIN
  PERFORM public.require_permission('metricas', 'ver');
  IF p_from IS NULL OR p_to IS NULL OR p_to < p_from OR p_to - p_from > 3660 THEN
    RAISE EXCEPTION 'rango_invalido' USING ERRCODE = 'P0001';
  END IF;

  WITH s AS (
    SELECT * FROM public.sales
     WHERE company_id = v_company AND NOT deleted AND sale_date BETWEEN p_from AND p_to
  ), i AS (
    SELECT it.* FROM public.sale_items it JOIN s ON s.id = it.sale_id
  )
  SELECT jsonb_build_object(
    'totals', (SELECT jsonb_build_object(
                 'sales',   count(*),
                 'revenue', COALESCE(sum(total), 0),
                 'pending', COALESCE(sum(total) FILTER (WHERE status = 'pending'), 0),
                 'units',   (SELECT COALESCE(sum(quantity), 0) FROM i))
               FROM s),
    'sellers', COALESCE((
      SELECT jsonb_agg(row_to_json(x) ORDER BY x.revenue DESC, x.name)
      FROM (
        SELECT se.id, se.name, se.active,
               count(s.id)                   AS sales,
               COALESCE(sum(s.total), 0)     AS revenue,
               COALESCE((SELECT sum(i.quantity) FROM i JOIN s s2 ON s2.id = i.sale_id WHERE s2.seller_id = se.id), 0) AS units
          FROM public.sellers se
          LEFT JOIN s ON s.seller_id = se.id
         WHERE se.company_id = v_company
         GROUP BY se.id
        HAVING count(s.id) > 0 OR se.active
      ) x), '[]'::jsonb),
    'products', COALESCE((
      SELECT jsonb_agg(row_to_json(x) ORDER BY x.units DESC, x.name)
      FROM (
        SELECT p.id, p.name, p.unit, sum(i.quantity) AS units, sum(i.total) AS revenue
          FROM i JOIN public.products p ON p.id = i.product_id
         GROUP BY p.id
         ORDER BY sum(i.quantity) DESC, p.name
         LIMIT 10
      ) x), '[]'::jsonb),
    'daily', COALESCE((
      SELECT jsonb_agg(row_to_json(x) ORDER BY x.day)
      FROM (SELECT sale_date AS day, count(*) AS sales, sum(total) AS revenue FROM s GROUP BY sale_date) x
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END $$;
REVOKE EXECUTE ON FUNCTION public.sales_metrics(DATE, DATE) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.sales_metrics(DATE, DATE) TO authenticated;
