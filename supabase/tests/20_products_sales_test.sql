-- Tests de la migración 20261101: productos, stock, ventas y métricas.
-- Se corre con supabase/tests/run.sh. Falla (exit != 0) si una aserción no se cumple.
\set ON_ERROR_STOP on

-- ── Fixture: empresa nueva con un admin y un viewer ──
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000000b1', 'admin@ventas.internal'),
  ('00000000-0000-0000-0000-0000000000b2', 'viewer@ventas.internal');

SELECT set_config('test.uid', '00000000-0000-0000-0000-0000000000b1', false);
SELECT public.bootstrap_company('ventas-co', 'Ventas Co', 'admin_ventas', 'Admin', 'free') AS company_id \gset

INSERT INTO public.user_companies (user_id, company_id, role_id)
SELECT '00000000-0000-0000-0000-0000000000b2', :'company_id', id FROM public.roles WHERE name = 'viewer';
INSERT INTO public.profiles (id, email, username, current_company_id)
VALUES ('00000000-0000-0000-0000-0000000000b2', 'viewer@ventas.internal', 'viewer_ventas', :'company_id')
ON CONFLICT (id) DO UPDATE SET current_company_id = EXCLUDED.current_company_id;

INSERT INTO public.clients (company_id, name, client_status, created_by)
VALUES (:'company_id', 'Ana', 'client', 'test');

INSERT INTO public.sellers (company_id, name) VALUES (:'company_id', 'Pedro'), (:'company_id', 'Lucía');
INSERT INTO public.sellers (company_id, name, active) VALUES (:'company_id', 'Ex vendedor', FALSE);

INSERT INTO public.products (company_id, name, unit, price, stock_current, stock_min) VALUES
  (:'company_id', 'Empanada de carne', 'unidad', 1.50, 20, 5),
  (:'company_id', 'Refresco',          'unidad', 2.00, 3,  2);

DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.stock_movements WHERE kind = 'initial') = 2,
         'el alta con stock debe dejar el movimiento inicial';
  ASSERT NOT EXISTS (SELECT 1 FROM public.low_stock_products),
         'ningún producto empieza con stock bajo';
END $$;

-- ── Venta: descuenta stock, suma líneas repetidas y avisa stock bajo ──
SELECT public.register_sale(
  (SELECT id FROM public.sellers WHERE name = 'Pedro'),
  jsonb_build_array(
    jsonb_build_object('product_id', (SELECT id FROM public.products WHERE name = 'Empanada de carne'), 'quantity', 10),
    jsonb_build_object('product_id', (SELECT id FROM public.products WHERE name = 'Empanada de carne'), 'quantity', 5),
    jsonb_build_object('product_id', (SELECT id FROM public.products WHERE name = 'Refresco'), 'quantity', 1)
  ),
  (SELECT id FROM public.clients WHERE name = 'Ana')
) AS sale \gset

SELECT set_config('test.sale', :'sale', false);

DO $$
DECLARE r JSONB := current_setting('test.sale')::jsonb;
BEGIN
  ASSERT (r->>'total')::numeric = 24.50, 'total esperado 15*1.50 + 2 = 24.50, vino ' || (r->>'total');
  ASSERT (SELECT stock_current FROM public.products WHERE name = 'Empanada de carne') = 5, 'quedan 5 empanadas';
  ASSERT (SELECT stock_current FROM public.products WHERE name = 'Refresco') = 2, 'quedan 2 refrescos';
  ASSERT jsonb_array_length(r->'low_stock') = 2, 'ambos productos llegaron al mínimo';
  ASSERT (SELECT count(*) FROM public.sale_items WHERE sale_id = (r->>'sale_id')::uuid) = 2,
         'las líneas del mismo producto se agrupan';
  ASSERT (SELECT status FROM public.sales WHERE id = (r->>'sale_id')::uuid) = 'pending', 'por defecto queda a cuenta';
  ASSERT (SELECT count(*) FROM public.low_stock_products) = 2, 'la vista lista los dos';
END $$;

-- ── Stock insuficiente: no se registra nada ──
DO $$ BEGIN
  BEGIN
    PERFORM public.register_sale(
      (SELECT id FROM public.sellers WHERE name = 'Lucía'),
      jsonb_build_array(jsonb_build_object('product_id', (SELECT id FROM public.products WHERE name = 'Refresco'), 'quantity', 3)));
    RAISE EXCEPTION 'TEST FALLÓ: vendió más stock del que hay';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM = 'stock_insuficiente:Refresco:2.00', 'mensaje inesperado: ' || SQLERRM;
  END;
  ASSERT (SELECT count(*) FROM public.sales WHERE company_id = public.current_company_id()) = 1, 'no quedó una venta a medias';
END $$;

-- ── Validaciones ──
DO $$
DECLARE
  v_prod UUID := (SELECT id FROM public.products WHERE name = 'Empanada de carne');
  v_cases TEXT[][] := ARRAY[
    ['vendedor inactivo', 'vendedor_invalido'],
    ['sin ítems',         'venta_sin_items'],
    ['cantidad 0',        'cantidad_invalida'],
    ['producto ajeno',    'producto_inexistente']
  ];
BEGIN
  BEGIN
    PERFORM public.register_sale((SELECT id FROM public.sellers WHERE name = 'Ex vendedor'),
      jsonb_build_array(jsonb_build_object('product_id', v_prod, 'quantity', 1)));
    RAISE EXCEPTION 'TEST FALLÓ: %', v_cases[1][1];
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = v_cases[1][2], SQLERRM; END;

  BEGIN
    PERFORM public.register_sale((SELECT id FROM public.sellers WHERE name = 'Pedro'), '[]'::jsonb);
    RAISE EXCEPTION 'TEST FALLÓ: %', v_cases[2][1];
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = v_cases[2][2], SQLERRM; END;

  BEGIN
    PERFORM public.register_sale((SELECT id FROM public.sellers WHERE name = 'Pedro'),
      jsonb_build_array(jsonb_build_object('product_id', v_prod, 'quantity', 0)));
    RAISE EXCEPTION 'TEST FALLÓ: %', v_cases[3][1];
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = v_cases[3][2], SQLERRM; END;

  BEGIN
    PERFORM public.register_sale((SELECT id FROM public.sellers WHERE name = 'Pedro'),
      jsonb_build_array(jsonb_build_object('product_id', gen_random_uuid(), 'quantity', 1)));
    RAISE EXCEPTION 'TEST FALLÓ: %', v_cases[4][1];
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = v_cases[4][2], SQLERRM; END;
END $$;

-- ── Compra de stock y ajuste ──
DO $$
DECLARE v_prod UUID := (SELECT id FROM public.products WHERE name = 'Refresco');
BEGIN
  ASSERT public.adjust_stock(v_prod, 10, 'purchase', 'Compra') = 12, 'compra suma';
  ASSERT public.adjust_stock(v_prod, -1, 'adjustment', 'Se rompió una') = 11, 'ajuste resta';
  BEGIN
    PERFORM public.adjust_stock(v_prod, -50, 'adjustment');
    RAISE EXCEPTION 'TEST FALLÓ: el stock quedó negativo';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'stock_negativo:11.00', SQLERRM; END;
  BEGIN
    PERFORM public.adjust_stock(v_prod, -1, 'purchase');
    RAISE EXCEPTION 'TEST FALLÓ: compra negativa';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'cantidad_invalida', SQLERRM; END;
  ASSERT (SELECT count(*) FROM public.low_stock_products) = 1, 'el refresco salió del stock bajo';
END $$;

-- ── Métricas por vendedor ──
SELECT public.register_sale(
  (SELECT id FROM public.sellers WHERE name = 'Lucía'),
  jsonb_build_array(jsonb_build_object('product_id', (SELECT id FROM public.products WHERE name = 'Refresco'), 'quantity', 2)),
  NULL, CURRENT_DATE, 'paid'
);

DO $$
DECLARE m JSONB := public.sales_metrics(CURRENT_DATE - 30, CURRENT_DATE);
BEGIN
  ASSERT (m->'totals'->>'sales')::int = 2, 'dos ventas';
  ASSERT (m->'totals'->>'revenue')::numeric = 28.50, 'facturado 24.50 + 4: ' || (m->'totals'->>'revenue');
  ASSERT (m->'totals'->>'pending')::numeric = 24.50, 'pendiente solo la de Ana';
  ASSERT (m->'totals'->>'units')::numeric = 18, 'unidades 15 + 1 + 2';
  ASSERT m->'sellers'->0->>'name' = 'Pedro', 'Pedro primero por facturación';
  ASSERT (m->'sellers'->0->>'sales')::int = 1 AND (m->'sellers'->1->>'sales')::int = 1, 'una venta cada uno';
  ASSERT NOT EXISTS (SELECT 1 FROM jsonb_array_elements(m->'sellers') s WHERE s->>'name' = 'Ex vendedor'),
         'un vendedor inactivo sin ventas no aparece';
  ASSERT m->'products'->0->>'name' = 'Empanada de carne', 'producto más vendido';
END $$;

-- ── Anular devuelve el stock ──
DO $$
DECLARE r JSONB := current_setting('test.sale')::jsonb;
BEGIN
  PERFORM public.cancel_sale((r->>'sale_id')::uuid);
  ASSERT (SELECT stock_current FROM public.products WHERE name = 'Empanada de carne') = 20, 'vuelven las 15 empanadas';
  ASSERT (SELECT deleted FROM public.sales WHERE id = (r->>'sale_id')::uuid), 'la venta queda anulada';
  ASSERT (public.sales_metrics(CURRENT_DATE - 30, CURRENT_DATE)->'totals'->>'sales')::int = 1, 'la anulada no cuenta';
  BEGIN
    PERFORM public.cancel_sale((r->>'sale_id')::uuid);
    RAISE EXCEPTION 'TEST FALLÓ: se anuló dos veces';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'venta_inexistente', SQLERRM; END;
END $$;

-- ── Como usuario de la API (rol authenticated) ──
SET ROLE authenticated;

DO $$ BEGIN
  -- No se puede tocar el stock a mano
  BEGIN
    UPDATE public.products SET stock_current = 999;
    RAISE EXCEPTION 'TEST FALLÓ: se pudo editar stock_current directo';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  -- Ni crear ventas sin pasar por la RPC
  BEGIN
    INSERT INTO public.sales (seller_id) VALUES ((SELECT id FROM public.sellers LIMIT 1));
    RAISE EXCEPTION 'TEST FALLÓ: se pudo insertar una venta directo';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  -- Sí editar datos del producto y marcar una venta como pagada
  UPDATE public.products SET stock_min = 1 WHERE name = 'Refresco';
  UPDATE public.sales SET status = 'paid', paid_at = NOW() WHERE status = 'pending';
END $$;

-- El viewer ve, pero no vende
SELECT set_config('test.uid', '00000000-0000-0000-0000-0000000000b2', false);
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.products) = 2, 'el viewer ve los productos de su empresa';
  BEGIN
    PERFORM public.register_sale((SELECT id FROM public.sellers WHERE name = 'Pedro'),
      jsonb_build_array(jsonb_build_object('product_id', (SELECT id FROM public.products WHERE name = 'Refresco'), 'quantity', 1)));
    RAISE EXCEPTION 'TEST FALLÓ: el viewer pudo vender';
  EXCEPTION WHEN insufficient_privilege THEN
    ASSERT SQLERRM = 'sin_permiso:ventas:crear', SQLERRM;
  END;
END $$;

-- Otra empresa no ve nada
SELECT set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.products) = 0, 'aislamiento entre empresas: productos';
  ASSERT (SELECT count(*) FROM public.sales) = 0,    'aislamiento entre empresas: ventas';
  ASSERT (public.sales_metrics(CURRENT_DATE - 30, CURRENT_DATE)->'totals'->>'sales')::int = 0, 'métricas aisladas';
END $$;

RESET ROLE;

-- anon (sin sesión) no lee nada de inventario
SET ROLE anon;
DO $$ BEGIN
  BEGIN
    PERFORM 1 FROM public.products;
    RAISE EXCEPTION 'TEST FALLÓ: anon pudo leer productos';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.register_sale(gen_random_uuid(), '[]'::jsonb);
    RAISE EXCEPTION 'TEST FALLÓ: anon pudo llamar a register_sale';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
\echo 'OK: tests de productos y ventas pasaron'
