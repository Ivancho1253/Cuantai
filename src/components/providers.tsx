'use client';
import { useText as useUiText } from './locale-provider';
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import * as Tooltip from '@radix-ui/react-tooltip';
import { LocaleProvider, type Locale } from './locale-provider';
export function Providers({
  children,
  locale = 'es',
}: {
  children: React.ReactNode;
  locale?: Locale;
}) {
  const uiText = useUiText();
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30000, retry: 1, refetchOnWindowFocus: false } },
      }),
  );
  return (
    <LocaleProvider initialLocale={locale}>
      <ThemeProvider attribute="data-theme" defaultTheme="dark" enableSystem>
        <QueryClientProvider client={client}>
          <Tooltip.Provider delayDuration={250}>
            {uiText(children)}
            <Toaster theme="system" richColors position="bottom-right" />
          </Tooltip.Provider>
        </QueryClientProvider>
      </ThemeProvider>
    </LocaleProvider>
  );
}
