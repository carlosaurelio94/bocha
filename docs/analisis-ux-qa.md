# Análisis UX/UI y QA — Bocha (octubre 2026)

Cómo se hizo: revisión del código de todas las pantallas, capturas en desktop (1366px) y mobile (390px)
con datos simulados, y pruebas automáticas. Los tests corren en la zona horaria `America/Caracas`
(UTC-4), que es la de los usuarios, para que aparezcan los errores de fechas que en UTC no se ven.

Severidad: 🔴 crítica · 🟠 alta · 🟡 media · ⚪ baja. Estado: ✅ corregido en este cambio · ⏳ pendiente.

---

## 1. Análisis QA (funcional y seguridad)

| # | Sev. | Hallazgo | Cómo se reproducía | Estado |
|---|------|----------|--------------------|--------|
| Q1 | 🔴 | **Cualquiera podía crearse una empresa con plan pago gratis.** `/api/auth/signup` tomaba `planSlug` del body, y la RPC `bootstrap_company` también aceptaba cualquier plan. | `POST /api/auth/signup` con `{"planSlug":"enterprise", ...}` | ✅ La API fuerza `free`; la RPC ignora el parámetro. **Hay que aplicar** `supabase/migrations/20261016_bootstrap_company_free_plan.sql` |
| Q2 | 🔴 | **El cambio de contraseña no verificaba la contraseña actual.** Pedía el campo pero no lo usaba. En una PC compartida con la sesión abierta, cualquiera podía cambiarla y dejar afuera al dueño. | Configuración → escribir cualquier cosa en "actual" | ✅ Ahora se re-autentica con la actual antes de cambiarla |
| Q3 | 🟠 | **Las fechas de los presupuestos se mostraban un día antes** en listas, detalle y **en el PDF que recibe el cliente**. `new Date('2026-10-06')` se interpreta como medianoche UTC, que en UTC-4 es el día 5. | Presupuesto del 06/10 → aparecía "05 oct." | ✅ `parseDate()` interpreta las columnas DATE como fecha local |
| Q4 | 🟠 | **Un presupuesto creado después de las 20 h quedaba con la fecha de mañana** (`toISOString()` da la fecha UTC). | Crear presupuesto a las 21 h | ✅ `toLocalISODate()` |
| Q5 | 🟠 | **La búsqueda de presupuestos por cliente no filtraba nada.** PostgREST no filtra las filas padre si el filtro está en una relación sin `!inner`: devolvía todos los presupuestos con el cliente en blanco ("—"). | Presupuestos → buscar "ana" | ✅ Join `!inner` solo cuando se busca |
| Q6 | 🟡 | **Buscar un cliente con coma o paréntesis daba error.** Ejemplo: "Jardines, C.A." rompía la sintaxis de `.or()`. | Clientes → buscar "Jardines, C.A." | ✅ `sanitizeSearch()` |
| Q7 | 🟡 | **Presupuestos sin ítems.** Si fallaba el insert de los ítems, la cabecera quedaba creada (no había transacción). | Error de red al guardar | ✅ Compensación: se da de baja la cabecera |
| Q8 | 🟡 | **CSV exportado roto o inseguro.** Las comillas no se escapaban, el texto empezado en `=`, `+`, `-` o `@` se ejecutaba como fórmula en Excel ("CSV injection"), los acentos salían mal y los estados aparecían en inglés. Si fallaba, no avisaba. | Cliente llamado `=HYPERLINK(...)` | ✅ `toCsv()` con escape, BOM y estados en español; aviso si falla; botón solo con permiso `exportar` |
| Q9 | 🟡 | **El registro se quedaba "cargando" para siempre** si el servidor respondía algo que no era JSON (502 o 500) o se cortaba la red. Lo mismo pasaba en los formularios de Usuarios y roles. | Cortar la red al enviar | ✅ `requestJson()` |
| Q10 | 🟡 | **La API de usuarios aceptaba contraseñas de 6 caracteres** y nombres de usuario con los que después no se podía iniciar sesión (acentos, símbolos). Un admin podía quitarse a sí mismo y dejar la empresa sin administrador. Con un JSON mal formado devolvía 500. | `POST /api/admin/users` con `{"username":"maría!","password":"123456"}` | ✅ Validación, mínimo de 8 caracteres y bloqueo para quitarse a uno mismo |
| Q11 | 🟡 | **Contraseña mínima inconsistente:** 8 caracteres en el registro, 6 en Configuración y en Usuarios. | — | ✅ 8 en todos lados |
| Q12 | ⚪ | **Las reglas de validación del registro estaban solo en el servidor**: el usuario se enteraba recién al enviar. | — | ✅ `signupValidation.ts`, compartido entre formulario y API, con errores por campo |
| Q13 | ⚪ | **Se podía perder un presupuesto a medio armar** al cerrar la pestaña o tocar Cancelar. | — | ✅ Aviso de cambios sin guardar |
| Q14 | 🟠 | El número de presupuesto se calcula en el cliente: dos usuarios creando a la vez podían obtener el mismo número. | Dos pestañas a la vez | ✅ Índice único `(company_id, quote_number)` + reintento automático con el siguiente número y aviso. Backend: 409 en vez de 500 |
| Q15 | 🟠 | `package-lock.json` generado en Windows: le faltaban los binarios de Linux de `lightningcss` y `@tailwindcss/oxide`, y el build del CI fallaba. | `npm ci && npm run build` en Linux | ✅ Regenerado con los binarios de todas las plataformas; verificado con `npm ci` limpio |
| Q16 | 🟠 | Los límites del plan (usuarios, clientes, presupuestos y facturas por mes) se mostraban pero no se aplicaban. | Crear el cliente 26 en plan Free | ✅ Trigger `enforce_plan_limit` en la base + aviso "Llegaste al límite de tu plan" con acceso a "Ver planes" |
| Q17 | 🔴 | **En Usuarios y roles, la ✕ de un rol sacaba al usuario de la empresa sin avisar.** Cada usuario tiene un solo rol por empresa, pero la UI mostraba varios "chips" de rol y borrar uno eliminaba la membresía. | Usuarios y roles → ✕ en el rol de alguien | ✅ Un selector de rol por usuario; quitar a alguien es una acción aparte y con confirmación |
| Q18 | 🟡 | El detalle de un presupuesto traía también los ítems dados de baja, y un presupuesto borrado se podía abrir por URL. | — | ✅ Filtro `deleted = false` en ambos |
| Q19 | 🟡 | La cantidad de un ítem aceptaba decimales ("1.5"), pero la columna es `INTEGER` y fallaba recién al guardar. | Cantidad 1.5 | ✅ Validación de entero en el formulario |
| Q20 | ⚪ | Al editar un presupuesto, el selector de cliente quedaba vacío porque las opciones llegan después. | — | ✅ Selección diferida hasta que cargan las opciones |
| Q21 | ⚪ | Botón "Comprobantes adjuntos" en Facturas que no hacía nada. | — | ✅ Quitado |

## 2. Análisis UX/UI

| # | Sev. | Hallazgo | Estado |
|---|------|----------|--------|
| U1 | 🟠 | **Configuración con jerarquía rota**: "Cambiar contraseña" aparecía *antes* del título de la página, y el subtítulo hablaba solo de presets. | ✅ Título arriba y dos secciones claras: "Textos al pie de los presupuestos" y "Seguridad" |
| U2 | 🟠 | **Jerga técnica**: "Slug (URL interna)", "preset". | ✅ "Dirección de acceso" con vista previa del link; "textos" en lugar de "presets" |
| U3 | 🟠 | **En mobile, el mensaje de lista vacía de Facturas y Proveedores quedaba cortado** por el scroll horizontal de la tabla. | ✅ El estado vacío se muestra fuera de la tabla |
| U4 | 🟡 | **Campos de contraseña sin label** (solo placeholder) y sin opción de mostrarla en login y registro. | ✅ Componente `PasswordInput` con label, botón para mostrar y descripción accesible |
| U5 | 🟡 | **Labels de login y registro sin asociar al input** (los lectores de pantalla no los leían). | ✅ Usan `Input`, que asocia `htmlFor`, `aria-invalid` y `aria-describedby` |
| U6 | 🟡 | **Modal sin trampa de foco**: con Tab se navegaba la página de atrás, y al cerrar se perdía el foco. | ✅ El foco queda dentro del modal y vuelve al botón que lo abrió |
| U7 | 🟡 | **Errores del registro poco claros**: aparecían de a uno y en un bloque genérico. | ✅ Error debajo de cada campo y contador de caracteres que faltan en la contraseña |
| U8 | ⚪ | **Encabezados inconsistentes** en Plan y facturación (ícono grande y otro estilo). | ✅ Usa `PageHeader` |
| U9 | ⚪ | **Las pestañas de filtro no indicaban cuál estaba activa** a los lectores de pantalla. | ✅ `aria-pressed` |
| U10 | 🟡 | Usuarios y roles usaba `confirm()` nativo, nombres técnicos de rol (`usuario_presupuestos`) y su propio estilo de formularios. | ✅ Modales propios, `Input`/`PasswordInput`/`Select`, roles con nombre legible y marca "(vos)" |
| U11 | 🟡 | Facturas y Proveedores: la tabla de 9 columnas en mobile dependía del scroll horizontal. | ✅ Vista de tarjetas en mobile, tabla en desktop |
| U12 | 🟠 | No había edición de presupuestos (solo crear, cambiar estado o borrar). | ✅ `/quotes/[id]/edit` con el mismo formulario del alta; reemplazo de ítems con reversión si algo falla |

## 3. Cobertura de tests agregada

- **Regresión de cada bug corregido**: fechas en UTC-4, búsqueda con `!inner`, comas en la búsqueda, rollback de ítems, CSV, plan forzado, verificación de contraseña, validaciones de las APIs.
- **API routes** (`/api/auth/signup`, `/api/admin/users`) en entorno node, con Supabase simulado.
- **Base de datos**: `supabase/tests/run.sh` aplica `schema.sql` + migraciones en un Postgres descartable y verifica límites del plan, números únicos y alta en plan free. Corre en CI (`.github/workflows/db-tests.yml`).
- **Total**: frontend 259 tests, backend 81, base de datos 1 suite de aserciones SQL.

## 4. Migraciones a aplicar en Supabase (SQL Editor, en orden)

1. `supabase/migrations/20261016_bootstrap_company_free_plan.sql`
2. `supabase/migrations/20261017_plan_limits_and_unique_quote_numbers.sql`: si hay números de presupuesto repetidos, avisa y no crea el índice (hay que corregirlos y volver a correrla)
