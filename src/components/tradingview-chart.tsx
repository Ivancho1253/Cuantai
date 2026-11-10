'use client';
import { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { ExternalLink, Maximize2, Minimize2, RefreshCw } from 'lucide-react';
import {
  TRADINGVIEW_SCRIPT,
  tradingViewOptions,
  tradingViewChartUrl,
  type TradingViewChartType,
} from '@/lib/market/tradingview';
import type { Timeframe } from '@/lib/market/types';
import { cn } from '@/lib/utils';
export function TradingViewChart({
  symbol,
  timeframe = '1D',
  chartType = 'candles',
  height = 620,
  theme: themeOverride,
}: {
  symbol: string | null;
  timeframe?: Timeframe;
  chartType?: TradingViewChartType;
  height?: number;
  theme?: 'dark' | 'light';
}) {
  const root = useRef<HTMLDivElement>(null),
    host = useRef<HTMLDivElement>(null),
    fullButton = useRef<HTMLButtonElement>(null);
  const nativeActive = useRef(false);
  const { resolvedTheme } = useTheme();
  const theme = themeOverride ?? (resolvedTheme === 'light' ? 'light' : 'dark');
  const [expanded, setExpanded] = useState(false),
    [attempt, setAttempt] = useState(0);
  const configuration = `${symbol}|${timeframe}|${chartType}|${theme}|${attempt}`;
  const [loadState, setLoadState] = useState<{
    key: string;
    phase: 'loading' | 'embedded' | 'error';
  }>({ key: '', phase: 'loading' });
  const phase = loadState.key === configuration ? loadState.phase : 'loading';
  useEffect(() => {
    const container = host.current;
    if (!container || !symbol) return;
    let disposed = false;
    const mount = document.createElement('div');
    mount.className = 'tradingview-widget-container';
    mount.style.cssText = 'height:100%;width:100%';
    const widget = document.createElement('div');
    widget.className = 'tradingview-widget-container__widget';
    widget.style.cssText = 'height:calc(100% - 32px);width:100%';
    const attribution = document.createElement('div');
    attribution.className = 'tradingview-widget-copyright';
    const link = document.createElement('a');
    link.href = tradingViewChartUrl(symbol);
    link.target = '_blank';
    link.rel = 'noopener nofollow';
    link.textContent = `${symbol} por TradingView`;
    attribution.append(link);
    const script = document.createElement('script');
    script.src = TRADINGVIEW_SCRIPT;
    script.async = true;
    script.type = 'text/javascript';
    script.textContent = JSON.stringify(tradingViewOptions(symbol, timeframe, chartType, theme));
    const fail = () => {
      if (!disposed) setLoadState({ key: configuration, phase: 'error' });
    };
    const timer = setTimeout(fail, 20000);
    script.addEventListener('error', fail);
    const ready = () => {
      if (!disposed) {
        clearTimeout(timer);
        setLoadState({ key: configuration, phase: 'embedded' });
      }
    };
    let frame: HTMLIFrameElement | null = null;
    const observer = new MutationObserver(() => {
      const found = mount.querySelector('iframe');
      if (!found || found === frame) return;
      frame = found;
      frame.title = `Gráfico de TradingView: ${symbol}`;
      frame.allowFullscreen = true;
      frame.addEventListener('load', ready);
    });
    observer.observe(mount, { childList: true, subtree: true });
    mount.append(widget, attribution, script);
    container.append(mount);
    return () => {
      disposed = true;
      clearTimeout(timer);
      observer.disconnect();
      frame?.removeEventListener('load', ready);
      script.removeEventListener('error', fail);
      mount.remove();
    };
  }, [symbol, timeframe, chartType, theme, attempt, configuration]);
  useEffect(() => {
    const changed = () => {
      if (document.fullscreenElement === root.current) nativeActive.current = true;
      else if (nativeActive.current) {
        nativeActive.current = false;
        setExpanded(false);
        fullButton.current?.focus({ preventScroll: true });
      }
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.fullscreenElement) setExpanded(false);
    };
    document.addEventListener('fullscreenchange', changed);
    window.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('fullscreenchange', changed);
      window.removeEventListener('keydown', key);
    };
  }, []);
  useEffect(() => {
    if (!expanded) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [expanded]);
  async function toggleFullScreen() {
    if (expanded) {
      if (document.fullscreenElement === root.current)
        await document.exitFullscreen().catch(() => {});
      setExpanded(false);
      fullButton.current?.focus({ preventScroll: true });
    } else {
      setExpanded(true);
      try {
        await root.current?.requestFullscreen?.();
      } catch {
        /* The viewport expansion remains available. */
      }
    }
  }
  return (
    <div
      ref={root}
      className={cn('tv-chart', expanded && 'tv-chart-expanded')}
      style={{ height }}
      data-symbol={symbol ?? ''}
      data-expanded={expanded}
      data-state={phase}
    >
      <div className="tv-chart-heading">
        <div>
          <strong>TradingView</strong>
          <span>{symbol ?? 'Sin símbolo compatible'}</span>
        </div>
        <div className="tv-chart-actions">
          {symbol && (
            <a
              className="icon-button"
              href={tradingViewChartUrl(symbol)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Abrir ${symbol} en TradingView`}
              title="Abrir en TradingView"
            >
              <ExternalLink size={14} />
            </a>
          )}
          <button
            className="icon-button"
            aria-label="Recargar TradingView"
            title="Recargar widget"
            onClick={() => {
              setAttempt((n) => n + 1);
            }}
          >
            <RefreshCw size={14} />
          </button>
          <button
            ref={fullButton}
            className="tv-fullscreen-button"
            onClick={toggleFullScreen}
            aria-label={expanded ? 'Salir de pantalla completa' : 'Pantalla completa'}
            title={expanded ? 'Salir · Esc' : 'Ampliar gráfico'}
          >
            {expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            <span>{expanded ? 'Salir' : 'Pantalla completa'}</span>
          </button>
        </div>
      </div>
      <div className="tv-chart-body">
        <div ref={host} className="tv-chart-host" />
        {!symbol ? (
          <div className="tv-chart-state">
            <strong>Sin correspondencia verificada para TradingView.</strong>
            <p>
              Buscá la especie y el mercado exactos en TradingView. No se reemplaza por otro activo.
            </p>
          </div>
        ) : (
          phase !== 'embedded' && (
            <div className="tv-chart-state" role="status">
              {phase === 'loading' ? (
                <>
                  <span className="loading-dot" />
                  <p>Cargando el gráfico oficial de TradingView…</p>
                </>
              ) : (
                <>
                  <strong>No se pudo cargar TradingView.</strong>
                  <p>Revisá la conexión o el bloqueo de contenido externo.</p>
                  <button
                    className="button button-secondary"
                    onClick={() => {
                      setAttempt((n) => n + 1);
                    }}
                  >
                    Reintentar
                  </button>
                  <a href={tradingViewChartUrl(symbol)} target="_blank" rel="noopener noreferrer">
                    Abrir directamente en TradingView <ExternalLink size={12} />
                  </a>
                </>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}
