'use client';
import { useText as useUiText } from './locale-provider';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { assetHref } from '@/lib/market/asset-href';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTheme } from 'next-themes';
import {
  LayoutDashboard,
  Globe2,
  CandlestickChart,
  ScanLine,
  Wallet,
  Star,
  Newspaper,
  Settings2,
  Search,
  ChevronDown,
  ArrowUpRight,
  Bell,
  LogOut,
  Sun,
  Moon,
  CircleHelp,
} from 'lucide-react';
import { Brand, Modal, AssetIcon, Button } from './ui';
import { api, cn } from '@/lib/utils';
import type { Instrument } from '@/lib/market/types';
import { authClient } from '@/lib/auth-client';
import { defaultPreferences } from '@/lib/preferences';
import { toast } from 'sonner';
import { MarketTicker } from './market-ticker';
import { LanguageSwitcher, useLocale, isLocale } from './locale-provider';
export type AppUser = {
  id: string;
  name: string;
  email: string;
};
const AppContext = createContext<{
  user: AppUser | null;
  demo: boolean;
  href: (view: string) => string;
  openSearch: () => void;
}>({ user: null, demo: true, href: () => '/demo', openSearch: () => {} });
export const useApp = () => useContext(AppContext);
const navigation = [
  {
    label: 'Mercado',
    items: [
      ['dashboard', 'Resumen', LayoutDashboard],
      ['markets', 'Mercados', Globe2],
      ['charts', 'Gráficos', CandlestickChart],
    ],
  },
  {
    label: 'Tu capital',
    items: [
      ['portfolio', 'Portafolio', Wallet],
      ['watchlists', 'Seguimiento', Star],
    ],
  },
  {
    label: 'Investigación',
    items: [
      ['analyst', 'Analista IA', ScanLine],
      ['news', 'Noticias', Newspaper],
    ],
  },
] as const;
export function AppShell({
  children,
  active,
  user = null,
  demo = false,
}: {
  children: React.ReactNode;
  active: string;
  user?: AppUser | null;
  demo?: boolean;
}) {
  const uiText = useUiText();
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [accountOpen, setAccountOpen] = useState(false);
  const accountTrigger = useRef<HTMLButtonElement>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const qc = useQueryClient();
  const { setLocale } = useLocale();
  const preferences = useQuery({
    queryKey: ['settings'],
    queryFn: () =>
      api<{
        preferences: Record<string, unknown>;
      }>('settings'),
    enabled: Boolean(user) && !demo,
  });
  useEffect(() => {
    const theme = preferences.data?.preferences.theme;
    if (typeof theme === 'string' && ['dark', 'light', 'system'].includes(theme)) setTheme(theme);
  }, [preferences.data?.preferences.theme, setTheme]);
  useEffect(() => {
    const language = preferences.data?.preferences.language;
    if (
      isLocale(language) &&
      !document.cookie.split(';').some((part) => part.trim().startsWith('cuantai_lang='))
    )
      setLocale(language);
  }, [preferences.data?.preferences.language, setLocale]);
  async function toggleTheme() {
    const theme = resolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(theme);
    if (user && !demo) {
      try {
        const next = { ...defaultPreferences, ...preferences.data?.preferences, theme };
        await api('settings', { method: 'PUT', body: JSON.stringify(next) });
        qc.setQueryData(['settings'], { preferences: next });
      } catch {
        toast.error('No se pudo guardar la preferencia de tema.');
      }
    }
  }
  const href = (view: string) => (demo ? `/demo?view=${view}` : `/${view}`);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  useEffect(() => {
    const timeout = setTimeout(() => setQuery(search), 200);
    return () => clearTimeout(timeout);
  }, [search]);
  const results = useQuery({
    queryKey: ['search', query, demo],
    queryFn: () =>
      api<{
        instruments: Instrument[];
        error?: string;
      }>(`instruments?q=${encodeURIComponent(query)}${demo ? '&demo=true' : ''}`),
    enabled: searchOpen,
  });
  const status = useQuery({
    queryKey: ['status'],
    queryFn: () =>
      api<{
        mode: string;
        binance: {
          configured: boolean;
          label: string;
        };
        twelveData: {
          configured: boolean;
          label: string;
        };
        finnhub: {
          configured: boolean;
          label: string;
        };
        news: {
          configured: boolean;
          label: string;
        };
        byma: {
          configured: boolean;
          label: string;
        };
        ai: {
          configured: boolean;
          label: string;
        };
      }>('status'),
  });
  return (
    <AppContext.Provider value={{ user, demo, href, openSearch: () => setSearchOpen(true) }}>
      <div className="app-layout workspace-horizontal">
        <a className="skip-link" href="#main-content">
          {uiText('Ir al contenido')}
        </a>
        <div className="app-main">
          <header className="topbar workspace-topbar">
            <Brand compact href={href('dashboard')} label="Cuantai, resumen" />
            <button
              className="workspace-search icon-button"
              aria-label={uiText('Buscar activo')}
              title={uiText('Buscar activo · Ctrl K')}
              onClick={() => setSearchOpen(true)}
            >
              <Search size={20} />
            </button>
            <nav className="workspace-nav" aria-label={uiText('Navegación principal')}>
              {navigation.map((group) =>
                group.items.map(([key, label, Icon]) => (
                  <Link
                    key={key}
                    href={href(key)}
                    className={cn('workspace-nav-link', active === key && 'active')}
                    aria-current={active === key ? 'page' : undefined}
                  >
                    <Icon size={17} aria-hidden="true" />
                    <span>{uiText(label)}</span>
                  </Link>
                )),
              )}
            </nav>
            <div className="topbar-actions">
              <LanguageSwitcher persist={Boolean(user) && !demo} />
              <button
                className="icon-button theme-toggle"
                aria-label={uiText('Cambiar tema')}
                onClick={toggleTheme}
              >
                <Sun size={17} className="theme-icon-dark" />
                <Moon size={17} className="theme-icon-light" />
              </button>
              <button
                className="icon-button workspace-notifications"
                aria-label={uiText('Notificaciones')}
                onClick={() => setNotifications(true)}
              >
                <Bell size={18} />
              </button>
              <button
                ref={accountTrigger}
                className="workspace-account"
                aria-label={uiText('Tu cuenta')}
                aria-haspopup="dialog"
                aria-expanded={accountOpen}
                onClick={() => setAccountOpen(true)}
              >
                <span className="user-avatar top-avatar">{user?.name.slice(0, 1) ?? 'C'}</span>
                <ChevronDown size={13} />
              </button>
            </div>
          </header>
          <MarketTicker />
          {uiText(
            (demo || status.data?.mode === 'demo') && (
              <div className="demo-strip">
                <span className="demo-indicator" />
                {uiText(
                  ' Datos demo de Cuantai \u00B7 14 mar 2025. Gr\u00E1ficos: fuente TradingView.',
                )}
                {uiText(' ')}
                <Link href={demo ? '/register' : href('settings')}>
                  {uiText(demo ? 'Crear mi espacio' : 'Ver proveedores')} <ArrowUpRight size={12} />
                </Link>
              </div>
            ),
          )}
          <main className="main-content" id="main-content">
            {uiText(children)}
          </main>
          <footer className="app-footer">
            <span>
              <span className="connection-dot" />
              {uiText(' Cuantai workspace')}
            </span>
            <span>{uiText('Datos con contexto. Decisiones con criterio.')}</span>
            <Link href="/data-policy">
              {uiText('Fuentes y metodolog\u00EDa ')}
              <ArrowUpRight size={11} />
            </Link>
            <a
              className="developer-credit"
              href="https://www.linkedin.com/in/ivangcabrera/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Dev by Ivan Cabrera
            </a>
          </footer>
        </div>
      </div>
      <Modal
        open={accountOpen}
        onOpenChange={(open) => {
          setAccountOpen(open);
          if (!open) requestAnimationFrame(() => accountTrigger.current?.focus());
        }}
        title={uiText('Tu cuenta')}
        description={user?.email ?? uiText('Estás en la demo')}
        className="workspace-account-modal"
      >
        <strong className="account-name">{user?.name ?? uiText('Explorador')}</strong>
        <div className="account-links">
          <Link href={href('settings')} onClick={() => setAccountOpen(false)}>
            <Settings2 size={19} />
            {uiText('Ajustes')}
            <ArrowUpRight size={16} />
          </Link>
          <Link href="/data-policy">
            <CircleHelp size={19} />
            {uiText('Fuentes y datos')}
            <ArrowUpRight size={16} />
          </Link>
          <button
            onClick={() => {
              setAccountOpen(false);
              setStatusOpen(true);
            }}
          >
            <Globe2 size={19} />
            {uiText('Fuentes de datos')}
            <ArrowUpRight size={16} />
          </button>
          {user ? (
            <button
              onClick={async () => {
                await authClient.signOut();
                qc.clear();
                router.replace('/login');
                router.refresh();
              }}
            >
              <LogOut size={19} />
              {uiText('Cerrar sesión')}
            </button>
          ) : (
            <Link href="/register">
              <ArrowUpRight size={19} />
              {uiText('Crear cuenta')}
            </Link>
          )}
        </div>
      </Modal>
      <Modal
        open={searchOpen}
        onOpenChange={setSearchOpen}
        title={uiText('Encontr\u00E1 tu pr\u00F3ximo an\u00E1lisis')}
        description={uiText('Busc\u00E1 por ticker, nombre, mercado o moneda.')}
        className="search-modal"
      >
        <div className="search-modal-input">
          <Search size={20} />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={uiText('AAPL, Bitcoin, JPM, BYMA...')}
            aria-label={uiText('Buscar instrumentos')}
          />
          <kbd>{uiText('ESC')}</kbd>
        </div>
        <div className="search-results">
          {uiText(
            results.isLoading ? (
              <p className="muted">{uiText('Buscando instrumentos...')}</p>
            ) : results.isError ? (
              <p role="alert">{uiText(results.error.message)}</p>
            ) : (
              results.data?.instruments.slice(0, 15).map((i) => (
                <Link
                  key={i.id}
                  href={assetHref(i, demo)}
                  className="search-result"
                  onClick={() => setSearchOpen(false)}
                >
                  <AssetIcon instrument={i} />
                  <div>
                    <strong>
                      {uiText(i.symbol)}
                      <small>{uiText(i.name)}</small>
                    </strong>
                  </div>
                  <span>
                    {uiText(i.exchange)} · {uiText(i.currency)}
                  </span>
                  <ArrowUpRight size={16} />
                </Link>
              ))
            ),
          )}
          {uiText(
            results.data?.instruments.length === 0 && (
              <p className="muted">{uiText('No hay resultados. Prob\u00E1 con otro ticker.')}</p>
            ),
          )}
        </div>
        <div className="search-modal-footer">
          {uiText('Instrumentos separados por mercado y moneda ')}
          <kbd>{uiText('\u2318 K')}</kbd>
        </div>
      </Modal>
      <Modal
        open={statusOpen}
        onOpenChange={setStatusOpen}
        title={uiText('Estado de los proveedores')}
        description={uiText(
          'Disponibilidad de configuraci\u00F3n. No implica validaci\u00F3n de licencia o conectividad.',
        )}
      >
        <div className="provider-list">
          {uiText(
            status.data &&
              (['binance', 'twelveData', 'finnhub', 'news', 'byma', 'ai'] as const).map((key) => (
                <div key={key}>
                  <span>{uiText(status.data[key].label)}</span>
                  <span className={status.data[key].configured ? 'positive' : 'muted'}>
                    {uiText(status.data[key].configured ? 'Configurado' : 'Sin credenciales')}
                  </span>
                </div>
              )),
          )}
        </div>
        <p className="form-hint">
          {uiText(
            'Cada cotizaci\u00F3n muestra su fuente, fecha y condici\u00F3n. Los datos demo no representan el mercado actual.',
          )}
        </p>
      </Modal>
      <Modal
        open={notifications}
        onOpenChange={setNotifications}
        title={uiText('Tu centro de actividad')}
        description={uiText('Las alertas autom\u00E1ticas a\u00FAn no est\u00E1n habilitadas.')}
      >
        <div className="notification-item">
          <Bell size={25} />
          <h3>{uiText('Un espacio sin ruido.')}</h3>
          <p>
            {uiText(
              'Las alertas de precio requieren un proceso de servidor y un feed autorizado. Tus watchlists ya pueden ayudarte a organizar el seguimiento.',
            )}
          </p>
          <Button
            onClick={() => {
              setNotifications(false);
              toast.info('Accedé a Watchlists desde el menú para crear tu lista.');
            }}
          >
            {uiText('Entendido')}
          </Button>
        </div>
      </Modal>
    </AppContext.Provider>
  );
}
