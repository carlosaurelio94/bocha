import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/layout/Providers';
import { PRODUCT_NAME, PRODUCT_TAGLINE } from '@/lib/brand';

const inter = Inter({ subsets: ['latin'] });

const SITE_URL = 'https://boviverourbano.vercel.app';
const DESCRIPTION =
  'Sistema de gestión de clientes, presupuestos, proveedores y facturas';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: `${PRODUCT_NAME} · ${PRODUCT_TAGLINE}`,
  description: DESCRIPTION,
  // Sin esto, LinkedIn y WhatsApp muestran el link pelado al compartirlo.
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: PRODUCT_NAME,
    title: `${PRODUCT_NAME} · ${PRODUCT_TAGLINE}`,
    description: DESCRIPTION,
    locale: 'es_AR',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: `${PRODUCT_NAME} — ${PRODUCT_TAGLINE}`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${PRODUCT_NAME} · ${PRODUCT_TAGLINE}`,
    description: DESCRIPTION,
    images: ['/og-image.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full" suppressHydrationWarning>
      {/*
        suppressHydrationWarning en <html> es necesario porque el hook useTheme
        agrega/quita la clase "dark" en el cliente — evita el warning de hidratación.

        Este script inline previene el "flash" de tema incorrecto antes de que
        React hidrate. Se ejecuta de forma síncrona antes de que el browser pinte.
      */}
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('theme');
                  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (saved === 'dark' || (!saved && prefersDark)) {
                    document.documentElement.classList.add('dark');
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className={`${inter.className} h-full antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
