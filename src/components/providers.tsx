'use client';
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import * as Tooltip from '@radix-ui/react-tooltip';
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30000, retry: 1, refetchOnWindowFocus: false } },
      }),
  );
  return (
    <ThemeProvider attribute="data-theme" defaultTheme="dark" enableSystem>
      <QueryClientProvider client={client}>
        <Tooltip.Provider delayDuration={250}>
          {children}
          <Toaster theme="system" richColors position="bottom-right" />
        </Tooltip.Provider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
