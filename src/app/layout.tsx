import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import localFont from 'next/font/local';
import { Providers } from '@/components/providers';
import './globals.css';
import './workspace.css';
import './research.css';
import './features.css';

const manrope = localFont({
  src: './fonts/Manrope-Variable.ttf',
  variable: '--font-sans',
  weight: '200 800',
  display: 'swap',
  fallback: ['Arial', 'sans-serif'],
});

const plexSans = localFont({
  src: './fonts/IBMPlexSans-Variable.ttf',
  variable: '--font-workspace',
  weight: '100 700',
  display: 'swap',
  preload: false,
  fallback: ['Arial', 'sans-serif'],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'),
  title: {
    default: 'Cuantai — Una nueva perspectiva de tus inversiones',
    template: '%s · Cuantai',
  },
  description:
    'Inteligencia financiera para conectar mercados, gráficos, investigación y tu portfolio. Acciones, criptomonedas y CEDEARs en un solo workspace.',
  openGraph: {
    type: 'website',
    locale: 'es_AR',
    title: 'Cuantai — El mercado, en perspectiva',
    description: 'Tu universo de inversión, conectado.',
    siteName: 'Cuantai',
  },
  robots: { index: true, follow: true },
  twitter: {
    card: 'summary_large_image',
    title: 'Cuantai — El mercado, en perspectiva',
    images: ['/opengraph-image'],
  },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0b0e11' };
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const preference = (await cookies()).get('cuantai_lang')?.value;
  const locale = preference === 'en' || preference === 'pt' ? preference : 'es';
  return (
    <html
      lang={locale}
      className={`${manrope.variable} ${plexSans.variable}`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body>
        <Providers locale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
