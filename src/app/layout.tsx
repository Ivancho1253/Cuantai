import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import localFont from 'next/font/local';
import { Providers } from '@/components/providers';
import './globals.css';
import './workspace.css';
import './research.css';
import './features.css';
import './horizontal-workspace.css';
import './chart-insights.css';
import './asset-detail.css';
import './form-controls.css';
import './technical-reading.css';
import './research-refresh.css';
import './asset-typography.css';
import './analyst-studio.css';
import './news-search.css';
import './asset-investor.css';
import './asset-synthesis.css';

const jakarta = localFont({
  src: './fonts/PlusJakartaSans-Variable.ttf',
  variable: '--font-sans',
  weight: '200 800',
  display: 'swap',
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
      className={`${jakarta.variable} ${jakarta.className}`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body>
        <Providers locale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
