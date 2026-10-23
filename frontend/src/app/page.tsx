import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Leaf,
  Users,
  FileText,
  Building2,
  Receipt,
  LayoutDashboard,
  ShieldCheck,
  Check,
  ArrowRight,
  Lock,
  Palette,
  Moon,
} from 'lucide-react';
import { PRODUCT_NAME, CONTACT_EMAIL } from '@/lib/brand';

/**
 * Landing pública del producto.
 *
 * Es la única página del sitio que se ve sin sesión además de /login y
 * /register (ver la lista `isPublic` en src/middleware.ts). El resto de la app
 * sigue detrás del middleware de auth.
 *
 * El nombre y el mail de contacto salen de @/lib/brand — no los hardcodees acá.
 */

export const metadata: Metadata = {
  title: `${PRODUCT_NAME} · Gestión de clientes, presupuestos y facturas`,
  description:
    'Backoffice en la nube para PyMEs: clientes, presupuestos con PDF, proveedores y facturas. Creá tu empresa gratis y empezá a operar hoy.',
};

const modules = [
  {
    icon: LayoutDashboard,
    title: 'Dashboard',
    body: 'Lo que pasó esta semana de un vistazo: presupuestos abiertos, facturas pendientes y actividad reciente.',
  },
  {
    icon: Users,
    title: 'Clientes',
    body: 'Ficha única por cliente con datos de contacto, historial de presupuestos y facturas asociadas.',
  },
  {
    icon: FileText,
    title: 'Presupuestos',
    body: 'Armalos por ítems, con totales automáticos, y exportalos en PDF listos para mandar al cliente.',
  },
  {
    icon: Building2,
    title: 'Proveedores',
    body: 'Registro de proveedores y sus comprobantes, para saber qué entró y qué falta pagar.',
  },
  {
    icon: Receipt,
    title: 'Facturas',
    body: 'Emisión y seguimiento del estado de cobro, conectadas al cliente y al presupuesto que las originó.',
  },
  {
    icon: ShieldCheck,
    title: 'Usuarios y roles',
    body: 'Cada persona ve solo su parte: permisos por módulo, con roles que definís vos para tu equipo.',
  },
];

const steps = [
  {
    n: '1',
    title: 'Creá tu empresa',
    body: 'Un formulario, sin tarjeta. Elegís el nombre, tu usuario administrador y ya tenés el backoffice vacío esperándote.',
  },
  {
    n: '2',
    title: 'Cargá tu operación',
    body: 'Sumás tus clientes y proveedores, y empezás a generar presupuestos. Invitás al resto del equipo con el rol que corresponda.',
  },
  {
    n: '3',
    title: 'Operá desde cualquier lado',
    body: 'Funciona en el navegador de la compu y del celular. Nada que instalar, nada que respaldar a mano.',
  },
];

const plans = [
  {
    name: 'Free',
    price: 'AR$ 0',
    period: 'para siempre',
    description: 'Para probar la herramienta con datos reales.',
    features: [
      '2 usuarios',
      '25 clientes',
      '20 presupuestos por mes',
      '10 facturas por mes',
      'Exportación a PDF',
    ],
    cta: { label: 'Empezar gratis', href: '/register' },
    highlight: false,
  },
  {
    name: 'Pro',
    price: 'AR$ 25.000',
    period: 'por mes',
    description: 'Equipos chicos en operación diaria.',
    features: [
      '10 usuarios',
      '500 clientes',
      '500 presupuestos por mes',
      '200 facturas por mes',
      'Logo y colores propios',
    ],
    cta: { label: 'Coordinar upgrade', href: `mailto:${CONTACT_EMAIL}?subject=Quiero%20el%20plan%20Pro` },
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: 'AR$ 80.000',
    period: 'por mes',
    description: 'Sin límites, con soporte prioritario.',
    features: [
      'Usuarios ilimitados',
      'Clientes ilimitados',
      'Sin tope de presupuestos ni facturas',
      'Soporte prioritario',
      'Acuerdo de nivel de servicio',
    ],
    cta: { label: 'Hablemos', href: `mailto:${CONTACT_EMAIL}?subject=Consulta%20plan%20Enterprise` },
    highlight: false,
  },
];

const faqs = [
  {
    q: '¿Mis datos se mezclan con los de otra empresa?',
    a: 'No. Cada empresa vive aislada: la base de datos filtra por empresa en cada consulta, así que un usuario tuyo solo puede leer y escribir lo de tu empresa, nunca lo de otra.',
  },
  {
    q: '¿Necesito instalar algo?',
    a: 'Nada. Es una aplicación web: entrás con usuario y contraseña desde cualquier navegador, en compu o celular.',
  },
  {
    q: '¿Puedo probarlo sin pagar?',
    a: 'Sí. El plan Free no pide tarjeta y no vence. Si tu operación crece y te quedan chicos los límites, cambiás de plan.',
  },
  {
    q: '¿Cómo cambio de plan?',
    a: 'Hoy los upgrades se coordinan por mail y los activamos nosotros. La pasarela de pago automática está en camino.',
  },
];

const tenantCards = [
  { name: 'Ferretería Central', color: 'bg-green-600', detail: 'sus clientes · sus presupuestos' },
  { name: 'Tu empresa', color: 'bg-emerald-500', detail: 'tus clientes · tus presupuestos' },
  { name: 'Otra empresa', color: 'bg-teal-600', detail: 'sus clientes · sus presupuestos' },
];

const tenantBullets = [
  { icon: Lock, text: 'Datos aislados por empresa, verificados en la base' },
  { icon: Palette, text: 'Logo y colores propios en tu pantalla de ingreso' },
  { icon: Users, text: 'Si manejás más de una empresa, cambiás entre ellas sin salir' },
  { icon: Moon, text: 'Modo oscuro y uso cómodo desde el celular' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 dark:bg-slate-950 dark:text-slate-100">

      {/* ───────────────── Nav ───────────────── */}
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-600 shadow-sm">
              <Leaf className="h-5 w-5 text-white" />
            </span>
            <span className="text-base font-bold">{PRODUCT_NAME}</span>
          </Link>

          <div className="hidden items-center gap-7 text-sm text-gray-600 md:flex dark:text-slate-400">
            <a href="#producto" className="transition-colors hover:text-green-600 dark:hover:text-green-400">Producto</a>
            <a href="#como-funciona" className="transition-colors hover:text-green-600 dark:hover:text-green-400">Cómo funciona</a>
            <a href="#precios" className="transition-colors hover:text-green-600 dark:hover:text-green-400">Precios</a>
            <a href="#faq" className="transition-colors hover:text-green-600 dark:hover:text-green-400">Preguntas</a>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/register"
              className="hidden rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-700 sm:inline-block"
            >
              Crear mi empresa
            </Link>
          </div>
        </nav>
      </header>

      <main>
        {/* ───────────────── Hero ───────────────── */}
        <section className="relative overflow-hidden border-b border-gray-200 dark:border-slate-800">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-40 h-80 bg-gradient-to-b from-green-100 to-transparent blur-3xl dark:from-green-950/40"
          />
          <div className="relative mx-auto max-w-6xl px-4 py-20 text-center sm:px-6 sm:py-28">
            <span className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-medium text-green-700 dark:border-green-900 dark:bg-green-950/50 dark:text-green-400">
              <Leaf className="h-3.5 w-3.5" />
              Ya en producción con empresas reales
            </span>

            <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
              El backoffice de tu empresa,{' '}
              <span className="text-green-600 dark:text-green-500">ordenado en un solo lugar</span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600 dark:text-slate-400">
              Clientes, presupuestos, proveedores y facturas dejan de vivir en planillas sueltas y
              cadenas de WhatsApp. Cada empresa entra con su propio usuario y ve únicamente su
              información.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/register"
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-6 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-green-700 sm:w-auto"
              >
                Crear mi empresa gratis
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 text-base font-semibold text-gray-700 ring-1 ring-inset ring-gray-300 transition-colors hover:bg-gray-50 sm:w-auto dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-700"
              >
                <Lock className="h-4 w-4" />
                Ya tengo cuenta
              </Link>
            </div>

            <p className="mt-4 text-sm text-gray-500 dark:text-slate-500">
              Plan gratuito, sin tarjeta de crédito.
            </p>
          </div>
        </section>

        {/* ───────────────── Qué incluye ───────────────── */}
        <section id="producto" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">Todo el circuito comercial</h2>
            <p className="mt-4 text-gray-600 dark:text-slate-400">
              Desde que entra el cliente hasta que se cobra la factura, con la misma información
              circulando entre módulos en lugar de copiarse a mano.
            </p>
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="rounded-2xl border border-gray-200 bg-white p-6 transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 dark:bg-green-950/50">
                  <Icon className="h-5 w-5 text-green-600 dark:text-green-500" />
                </span>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-slate-400">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ───────────────── Multiempresa ───────────────── */}
        <section className="border-y border-gray-200 bg-gray-50 dark:border-slate-800 dark:bg-slate-900/50">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:items-center">
            <div>
              <span className="text-sm font-semibold uppercase tracking-wide text-green-600 dark:text-green-500">
                Una instalación, muchas empresas
              </span>
              <h2 className="mt-3 text-3xl font-bold tracking-tight">
                Tu empresa entra acá, con sus datos separados del resto
              </h2>
              <p className="mt-5 leading-relaxed text-gray-600 dark:text-slate-400">
                El sistema es multiempresa: la misma aplicación atiende a varias organizaciones a la
                vez, pero cada una tiene su propio espacio. Tus clientes, tus presupuestos y tus
                facturas solo los ven los usuarios que vos habilitaste.
              </p>
              <p className="mt-4 leading-relaxed text-gray-600 dark:text-slate-400">
                El aislamiento no depende de que la pantalla filtre bien: está hecho en la base de
                datos, que rechaza cualquier lectura o escritura fuera de la empresa del usuario
                conectado.
              </p>

              <ul className="mt-8 space-y-3">
                {tenantBullets.map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-start gap-3 text-sm text-gray-700 dark:text-slate-300">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-green-600 dark:text-green-500" />
                    {text}
                  </li>
                ))}
              </ul>
            </div>

            {/* Ilustración del aislamiento entre empresas */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-slate-500">
                Una sola aplicación
              </p>
              <div className="mt-4 space-y-3">
                {tenantCards.map(({ name, color, detail }) => (
                  <div
                    key={name}
                    className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800"
                  >
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${color}`}>
                      <Building2 className="h-4 w-4 text-white" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{name}</p>
                      <p className="truncate text-xs text-gray-500 dark:text-slate-400">{detail}</p>
                    </div>
                    <Lock className="ml-auto h-4 w-4 shrink-0 text-gray-400 dark:text-slate-500" />
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs leading-relaxed text-gray-500 dark:text-slate-400">
                Ninguna de las tres puede ver la información de las otras, aunque compartan el mismo
                sistema.
              </p>
            </div>
          </div>
        </section>

        {/* ───────────────── Cómo funciona ───────────────── */}
        <section id="como-funciona" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">Cómo empezás</h2>
            <p className="mt-4 text-gray-600 dark:text-slate-400">
              Tres pasos y el mismo día ya estás emitiendo presupuestos.
            </p>
          </div>

          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {steps.map(({ n, title, body }) => (
              <div key={n}>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-600 text-base font-bold text-white">
                  {n}
                </span>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-slate-400">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ───────────────── Precios ───────────────── */}
        <section id="precios" className="border-y border-gray-200 bg-gray-50 dark:border-slate-800 dark:bg-slate-900/50">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight">Precios</h2>
              <p className="mt-4 text-gray-600 dark:text-slate-400">
                Arrancás en Free y cambiás de plan cuando la operación lo pida.
              </p>
            </div>

            <div className="mt-14 grid items-start gap-6 lg:grid-cols-3">
              {plans.map((plan) => (
                <div
                  key={plan.name}
                  className={
                    plan.highlight
                      ? 'relative rounded-2xl border-2 border-green-600 bg-white p-8 shadow-lg dark:bg-slate-900'
                      : 'rounded-2xl border border-gray-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-900'
                  }
                >
                  {plan.highlight && (
                    <span className="absolute -top-3 left-8 rounded-full bg-green-600 px-3 py-1 text-xs font-semibold text-white">
                      Más elegido
                    </span>
                  )}

                  <h3 className="font-semibold">{plan.name}</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">{plan.description}</p>

                  <p className="mt-6 text-3xl font-bold">{plan.price}</p>
                  <p className="text-sm text-gray-500 dark:text-slate-400">{plan.period}</p>

                  <ul className="mt-6 space-y-3">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-gray-700 dark:text-slate-300">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600 dark:text-green-500" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={plan.cta.href}
                    className={
                      plan.highlight
                        ? 'mt-8 block rounded-lg bg-green-600 px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-green-700'
                        : 'mt-8 block rounded-lg bg-white px-4 py-2.5 text-center text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300 transition-colors hover:bg-gray-50 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-700'
                    }
                  >
                    {plan.cta.label}
                  </Link>
                </div>
              ))}
            </div>

            <p className="mt-8 text-center text-sm text-gray-500 dark:text-slate-400">
              Los cambios de plan se coordinan por mail y los activamos nosotros. Todavía no hay
              cobro automático.
            </p>
          </div>
        </section>

        {/* ───────────────── FAQ ───────────────── */}
        <section id="faq" className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight">Preguntas frecuentes</h2>
          <div className="mt-12 divide-y divide-gray-200 dark:divide-slate-800">
            {faqs.map(({ q, a }) => (
              <details key={q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                  {q}
                  <span className="shrink-0 text-gray-400 transition-transform group-open:rotate-45 dark:text-slate-500">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-slate-400">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ───────────────── CTA final ───────────────── */}
        <section className="border-t border-gray-200 bg-green-600 dark:border-slate-800 dark:bg-green-800">
          <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
            <h2 className="text-3xl font-bold tracking-tight text-white">
              Poné tu empresa en orden esta semana
            </h2>
            <p className="mt-4 text-green-50">
              Creás la cuenta en un minuto y empezás con el plan gratuito.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/register"
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 text-base font-semibold text-green-700 shadow-sm transition-colors hover:bg-green-50 sm:w-auto"
              >
                Crear mi empresa gratis
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex w-full items-center justify-center rounded-lg px-6 py-3 text-base font-semibold text-white ring-1 ring-inset ring-white/40 transition-colors hover:bg-white/10 sm:w-auto"
              >
                Iniciar sesión
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ───────────────── Footer ───────────────── */}
      <footer className="border-t border-gray-200 dark:border-slate-800">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-10 text-sm text-gray-500 sm:flex-row sm:px-6 dark:text-slate-500">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-green-600">
              <Leaf className="h-4 w-4 text-white" />
            </span>
            <span>{PRODUCT_NAME} · {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-6">
            <a href={`mailto:${CONTACT_EMAIL}`} className="transition-colors hover:text-green-600 dark:hover:text-green-400">
              Contacto
            </a>
            <Link href="/login" className="transition-colors hover:text-green-600 dark:hover:text-green-400">
              Iniciar sesión
            </Link>
            <Link href="/register" className="transition-colors hover:text-green-600 dark:hover:text-green-400">
              Crear empresa
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
