'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTheme } from 'next-themes';
import {
  LayoutDashboard,
  Globe2,
  CandlestickChart,
  Sparkles,
  Wallet,
  Star,
  Newspaper,
  Settings2,
  Search,
  ChevronDown,
  ArrowUpRight,
  Bell,
  PanelLeftClose,
  Menu,
  Command,
  LogOut,
  Sun,
  Moon,
  CircleHelp,
} from 'lucide-react';
import { Brand, Modal, AssetIcon, DataBadge, Button } from './ui';
import { api, cn } from '@/lib/utils';
import type { Instrument } from '@/lib/market/types';
import { authClient } from '@/lib/auth-client';
import { defaultPreferences } from '@/lib/preferences';
import { toast } from 'sonner';
export type AppUser = { id: string; name: string; email: string };
const AppContext = createContext<{
  user: AppUser | null;
  demo: boolean;
  href: (view: string) => string;
  openSearch: () => void;
}>({ user: null, demo: true, href: () => '/demo', openSearch: () => {} });
export const useApp = () => useContext(AppContext);
const navigation = [
  ['dashboard', 'Overview', LayoutDashboard],
  ['markets', 'Markets', Globe2],
  ['charts', 'Charts', CandlestickChart],
  ['analyst', 'AI Analyst', Sparkles],
  ['portfolio', 'Portfolio', Wallet],
  ['watchlists', 'Watchlists', Star],
  ['news', 'News', Newspaper],
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
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [mobile, setMobile] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const qc = useQueryClient();
  const preferences = useQuery({
    queryKey: ['settings'],
    queryFn: () => api<{ preferences: Record<string, unknown> }>('settings'),
    enabled: Boolean(user) && !demo,
  });
  useEffect(() => {
    const theme = preferences.data?.preferences.theme;
    if (typeof theme === 'string' && ['dark', 'light', 'system'].includes(theme)) setTheme(theme);
  }, [preferences.data?.preferences.theme, setTheme]);
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
      api<{ instruments: Instrument[]; error?: string }>(
        `instruments?q=${encodeURIComponent(query)}${demo ? '&demo=true' : ''}`,
      ),
    enabled: searchOpen,
  });
  const status = useQuery({
    queryKey: ['status'],
    queryFn: () =>
      api<{
        mode: string;
        binance: { configured: boolean; label: string };
        twelveData: { configured: boolean; label: string };
        finnhub: { configured: boolean; label: string };
        byma: { configured: boolean; label: string };
        ai: { configured: boolean; label: string };
      }>('status'),
  });
  return (
    <AppContext.Provider value={{ user, demo, href, openSearch: () => setSearchOpen(true) }}>
      <div className="app-layout">
        <a className="skip-link" href="#main-content">
          Ir al contenido
        </a>
        {mobile && (
          <button
            className="sidebar-backdrop"
            aria-label="Cerrar menú"
            onClick={() => setMobile(false)}
          />
        )}
        <aside className={cn('sidebar', mobile && 'sidebar-open')}>
          <div className="sidebar-brand">
            <Brand />
            <button
              className="icon-button mobile-only"
              onClick={() => setMobile(false)}
              aria-label="Cerrar menú"
            >
              <PanelLeftClose size={18} />
            </button>
          </div>
          <div className="workspace-label">
            <span className="workspace-avatar">C</span>
            <div>
              Personal workspace
              <small>{demo ? 'Exploración de producto' : 'Tu espacio privado'}</small>
            </div>
            <ChevronDown size={14} />
          </div>
          <div className="nav-label">WORKSPACE</div>
          <nav aria-label="Navegación principal">
            {navigation.map(([key, label, Icon]) => (
              <Link
                key={key}
                href={href(key)}
                onClick={() => setMobile(false)}
                className={cn('nav-item', active === key && 'active')}
                aria-current={active === key ? 'page' : undefined}
              >
                <Icon size={18} />
                <span>{label}</span>
                {key === 'analyst' && <span className="nav-tag">AI</span>}
                {active === key && <span className="nav-active-dot" />}
              </Link>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="sidebar-note">
              <div className="little-orbit">
                <Sparkles size={17} />
              </div>
              <strong>Una visión más completa.</strong>
              <p>
                Conectá los datos.
                <br />
                Entendé el contexto.
              </p>
              <Link href={href('analyst')}>
                Explorar el analista <ArrowUpRight size={14} />
              </Link>
            </div>
            <Link
              className={cn('nav-item', active === 'settings' && 'active')}
              href={href('settings')}
            >
              <Settings2 size={18} />
              Settings
            </Link>
            <Link className="nav-item" href="/data-policy">
              <CircleHelp size={18} />
              Datos y transparencia
            </Link>
            <div className="sidebar-user">
              <span className="user-avatar">{user?.name.slice(0, 2).toUpperCase() ?? 'EX'}</span>
              <div>
                <strong>{user?.name ?? 'Explorador'}</strong>
                <small>{user ? 'Personal account' : 'Modo demo'}</small>
              </div>
              {user ? (
                <button
                  className="icon-button"
                  title="Cerrar sesión"
                  aria-label="Cerrar sesión"
                  onClick={async () => {
                    await authClient.signOut();
                    qc.clear();
                    router.replace('/login');
                    router.refresh();
                  }}
                >
                  <LogOut size={16} />
                </button>
              ) : (
                <Link href="/register" className="icon-button" aria-label="Crear cuenta">
                  <ArrowUpRight size={16} />
                </Link>
              )}
            </div>
          </div>
        </aside>
        <div className="app-main">
          <header className="topbar">
            <button
              className="icon-button mobile-only"
              aria-label="Abrir menú"
              onClick={() => setMobile(true)}
            >
              <Menu size={20} />
            </button>
            <button className="global-search" onClick={() => setSearchOpen(true)}>
              <Search size={16} />
              <span>Buscar activos, mercados...</span>
              <kbd>
                <Command size={10} /> K
              </kbd>
            </button>
            <div className="topbar-actions">
              <Link className="market-select" href={href('markets')}>
                <Globe2 size={14} /> Global markets <ChevronDown size={12} />
              </Link>
              <span className="topbar-divider" />
              <button className="status-trigger" onClick={() => setStatusOpen(true)}>
                {demo || status.data?.mode === 'demo' ? (
                  <DataBadge status="demo" />
                ) : (
                  <span className="outlined-chip">Fuentes de datos</span>
                )}
              </button>
              <button
                className="icon-button theme-toggle"
                aria-label="Cambiar tema"
                onClick={toggleTheme}
              >
                <Sun size={17} className="theme-icon-dark" />
                <Moon size={17} className="theme-icon-light" />
              </button>
              <button
                className="icon-button"
                aria-label="Notificaciones"
                onClick={() => setNotifications(true)}
              >
                <Bell size={18} />
              </button>
              <Link href={href('settings')} className="user-avatar top-avatar" aria-label="Perfil">
                {user?.name.slice(0, 1) ?? 'C'}
              </Link>
            </div>
          </header>
          {(demo || status.data?.mode === 'demo') && (
            <div className="demo-strip">
              <span className="demo-indicator" /> Explorá con datos sintéticos · Snapshot
              ilustrativo: 14 mar 2025{' '}
              <Link href={demo ? '/register' : href('settings')}>
                {demo ? 'Crear mi espacio' : 'Ver proveedores'} <ArrowUpRight size={12} />
              </Link>
            </div>
          )}
          <main className="main-content" id="main-content">
            {children}
          </main>
          <footer className="app-footer">
            <span>
              <span className="connection-dot" /> Cuantai workspace
            </span>
            <span>Datos con contexto. Decisiones con criterio.</span>
            <Link href="/data-policy">
              Fuentes y metodología <ArrowUpRight size={11} />
            </Link>
          </footer>
        </div>
      </div>
      <Modal
        open={searchOpen}
        onOpenChange={setSearchOpen}
        title="Encontrá tu próximo análisis"
        description="Buscá por ticker, nombre, mercado o moneda."
        className="search-modal"
      >
        <div className="search-modal-input">
          <Search size={20} />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="AAPL, Bitcoin, JPM, BYMA..."
            aria-label="Buscar instrumentos"
          />
          <kbd>ESC</kbd>
        </div>
        <div className="search-results">
          {results.isLoading ? (
            <p className="muted">Buscando instrumentos...</p>
          ) : results.isError ? (
            <p role="alert">{results.error.message}</p>
          ) : (
            results.data?.instruments.slice(0, 15).map((i) => (
              <Link
                key={i.id}
                href={`/asset/${i.exchange}/${i.symbol}${demo ? '?demo=true' : ''}`}
                className="search-result"
                onClick={() => setSearchOpen(false)}
              >
                <AssetIcon instrument={i} />
                <div>
                  <strong>
                    {i.symbol}
                    <small>{i.name}</small>
                  </strong>
                </div>
                <span>
                  {i.exchange} · {i.currency}
                </span>
                <ArrowUpRight size={16} />
              </Link>
            ))
          )}
          {results.data?.instruments.length === 0 && (
            <p className="muted">No hay resultados. Probá con otro ticker.</p>
          )}
        </div>
        <div className="search-modal-footer">
          Instrumentos separados por mercado y moneda <kbd>⌘ K</kbd>
        </div>
      </Modal>
      <Modal
        open={statusOpen}
        onOpenChange={setStatusOpen}
        title="Estado de los proveedores"
        description="Disponibilidad de configuración. No implica validación de licencia o conectividad."
      >
        <div className="provider-list">
          {status.data &&
            (['binance', 'twelveData', 'finnhub', 'byma', 'ai'] as const).map((key) => (
              <div key={key}>
                <span>{status.data[key].label}</span>
                <span className={status.data[key].configured ? 'positive' : 'muted'}>
                  {status.data[key].configured ? 'Configurado' : 'Sin credenciales'}
                </span>
              </div>
            ))}
        </div>
        <p className="form-hint">
          Cada cotización muestra su fuente, fecha y condición. Los datos demo no representan el
          mercado actual.
        </p>
      </Modal>
      <Modal
        open={notifications}
        onOpenChange={setNotifications}
        title="Tu centro de actividad"
        description="Las alertas automáticas aún no están habilitadas."
      >
        <div className="notification-item">
          <Bell size={25} />
          <h3>Un espacio sin ruido.</h3>
          <p>
            Las alertas de precio requieren un proceso de servidor y un feed autorizado. Tus
            watchlists ya pueden ayudarte a organizar el seguimiento.
          </p>
          <Button
            onClick={() => {
              setNotifications(false);
              toast.info('Accedé a Watchlists desde el menú para crear tu lista.');
            }}
          >
            Entendido
          </Button>
        </div>
      </Modal>
    </AppContext.Provider>
  );
}
