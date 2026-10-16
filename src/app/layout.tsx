import type { Metadata, Viewport } from 'next';
import { Providers } from '@/components/providers';
import './globals.css';
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
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
