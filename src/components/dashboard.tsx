'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight,
  ArrowRight,
  Sparkles,
  Plus,
  ChevronDown,
  Globe2,
  ExternalLink,
  SlidersHorizontal,
  MoveUpRight,
  Wallet,
} from 'lucide-react';
import { useApp } from './app-shell';
import { api, number, dateLabel, cn } from '@/lib/utils';
import type { MarketSnapshot } from '@/lib/market/types';
import { FinancialChart } from './financial-chart';
import { Sparkline } from './sparkline';
import { MarketTable } from './market-table';
import { DataBadge, ErrorState, Skeleton, AssetIcon } from './ui';
const benchmarks = [
  ['NYSE:SPY:USD', 'S&P 500', 'SPY · ETF proxy'],
  ['NASDAQ:QQQ:USD', 'Nasdaq-100', 'QQQ · ETF proxy'],
  ['NYSE:DIA:USD', 'Dow Jones', 'DIA · ETF proxy'],
  ['BINANCE:BTCUSDT:USDT', 'Bitcoin', 'BTC / USDT'],
];
export function Dashboard() {
  const { user, demo, href, openSearch } = useApp();
  const [selected, setSelected] = useState('NASDAQ:NVDA:USD');
  const [period, setPeriod] = useState('3M');
  const [tab, setTab] = useState('Destacados');
  const overview = useQuery({
    queryKey: ['overview', demo],
    queryFn: () => api<MarketSnapshot[]>(`overview${demo ? '?demo=true' : ''}`),
  });
  const chartData = useQuery({
    queryKey: ['market', selected, '1D', demo],
    queryFn: () =>
      api<MarketSnapshot>(
        `market?id=${encodeURIComponent(selected)}&timeframe=1D${demo ? '&demo=true' : ''}`,
      ),
  });
  const selectedData = chartData.data;
  const data = overview.data ?? [];
  const filtered =
    tab === 'Cripto'
      ? data.filter((d) => d.instrument.type === 'crypto')
      : tab === 'ETFs'
        ? data.filter((d) => d.instrument.type === 'etf')
        : data.filter((d) => d.instrument.type === 'stock').slice(0, 6);
  const chartCandles =
    selectedData?.candles.slice(
      period === '1M' ? -22 : period === '3M' ? -66 : period === '6M' ? -132 : -280,
    ) ?? [];
  return (
    <div className="dashboard-page">
      <div className="overview-heading">
        <div>
          <div className="eyebrow">
            <span className="tiny-line" /> TU VENTAJA EMPIEZA CON CLARIDAD
          </div>
          <h1>
            El mercado, en perspectiva<span>.</span>
          </h1>
          <p>
            {user ? `Hola, ${user.name.split(' ')[0]}. ` : ''}Tu universo de inversión, conectado en
            un solo lugar.
          </p>
        </div>
        <Link className="button button-secondary" href={href('charts')}>
          <CandlesIcon /> Abrir terminal <ArrowUpRight size={15} />
        </Link>
      </div>
      <div className="benchmark-grid">
        {benchmarks.map(([id, name, sub]) => {
          const item = data.find((d) => d.instrument.id === id);
          const up = Number(item?.quote?.changePercent ?? 0) >= 0;
          return (
            <button
              className={cn('benchmark-card', selected === id && 'selected')}
              key={id}
              onClick={() => setSelected(id)}
            >
              <div className="benchmark-top">
                <span>{name}</span>
                <ArrowUpRight size={14} />
              </div>
              <div className="benchmark-value">
                {overview.isLoading ? (
                  <Skeleton className="price-skeleton" />
                ) : (
                  number(item?.quote?.price)
                )}
                <span className={up ? 'positive' : 'negative'}>
                  {item?.quote ? `${up ? '+' : ''}${number(item.quote.changePercent)}%` : '—'}
                </span>
              </div>
              <div className="benchmark-bottom">
                <small>{sub}</small>
                <Sparkline
                  values={item?.candles.slice(-24).map((c) => c.close) ?? []}
                  positive={up}
                />
              </div>
            </button>
          );
        })}
      </div>
      {overview.isError && (
        <ErrorState message={overview.error.message} retry={() => overview.refetch()} />
      )}
      <div className="dashboard-middle">
        <section className="panel main-chart-panel">
          <div className="panel-header">
            <div className="panel-heading">
              Market overview <span className="subtle-dot" />{' '}
              <span className="muted normal-weight">Tu foco de hoy</span>
            </div>
            <Link className="icon-button" href={href('charts')} aria-label="Expandir gráfico">
              <ArrowUpRight size={18} />
            </Link>
          </div>
          <div className="overview-chart-header">
            <div className="asset-cell">
              {selectedData && <AssetIcon instrument={selectedData.instrument} />}
              <div>
                <button className="asset-select" onClick={openSearch}>
                  {selectedData?.instrument.name ?? 'Cargando activo'} <ChevronDown size={14} />
                </button>
                <small>
                  {selectedData?.instrument.symbol} · {selectedData?.instrument.exchange} ·{' '}
                  {selectedData?.instrument.currency}
                </small>
              </div>
            </div>
            <DataBadge status={selectedData?.quote?.status ?? 'demo'} />
          </div>
          <div className="overview-price">
            <strong>{number(selectedData?.quote?.price)}</strong>
            <span
              className={
                Number(selectedData?.quote?.changePercent ?? 0) >= 0 ? 'positive' : 'negative'
              }
            >
              {Number(selectedData?.quote?.changePercent ?? 0) >= 0 ? '+' : ''}
              {number(selectedData?.quote?.changePercent)}%{' '}
              <small>
                {selectedData?.instrument.type === 'crypto' ? 'últimas 24h' : 'última sesión'}
              </small>
            </span>
          </div>
          <div className="chart-periods">
            {['1M', '3M', '6M', '1Y'].map((p) => (
              <button className={period === p ? 'active' : ''} key={p} onClick={() => setPeriod(p)}>
                {p}
              </button>
            ))}
            <Link href={href('charts')}>
              <SlidersHorizontal size={13} /> Indicadores
            </Link>
          </div>
          {chartData.isLoading ? (
            <Skeleton className="chart-skeleton" />
          ) : chartCandles.length ? (
            <FinancialChart candles={chartCandles} chartType="area" height={260} volume={false} />
          ) : (
            <div className="chart-unavailable">
              {selectedData?.error ?? 'Histórico no disponible'}
            </div>
          )}
          <div className="chart-source">
            <span>
              {selectedData?.provenance.source ?? 'Cargando fuente'} ·{' '}
              {dateLabel(selectedData?.provenance.asOf ?? '')}
            </span>
            <span>USD / USDT según instrumento</span>
          </div>
        </section>
        <aside className="insight-column">
          <section className="analyst-card">
            <div className="analyst-card-top">
              <span className="ai-icon">
                <Sparkles size={18} />
              </span>
              <span>CUANTAI INTELLIGENCE</span>
              <span className="ai-small">AI</span>
            </div>
            <h2>
              Detrás de cada movimiento,
              <br />
              <em>hay una historia.</em>
            </h2>
            <p>
              Conectá precio, tendencia y contexto. Transformá los datos en una tesis que puedas
              entender.
            </p>
            <div className="analysis-preview">
              <div>
                <span className="analysis-line" /> Evidencia antes que conclusiones
              </div>
              <div>
                <span className="analysis-line purple" /> Escenarios, riesgos y fuentes
              </div>
            </div>
            <Link href={href('analyst')} className="analyst-cta">
              Explorar AI Analyst <ArrowUpRight size={17} />
            </Link>
          </section>
          <section className="panel watch-preview">
            <div className="panel-header">
              <strong>En tu radar</strong>
              <button onClick={openSearch} className="icon-button" aria-label="Buscar activo">
                <Plus size={16} />
              </button>
            </div>
            {data
              .filter((i) => ['AAPL', 'JPM', 'ETHUSDT'].includes(i.instrument.symbol))
              .map((i) => (
                <Link
                  href={`/asset/${i.instrument.exchange}/${i.instrument.symbol}${demo ? '?demo=true' : ''}`}
                  className="radar-row"
                  key={i.instrument.id}
                >
                  <AssetIcon instrument={i.instrument} small />
                  <div>
                    <strong>{i.instrument.symbol}</strong>
                    <small>{i.instrument.exchange}</small>
                  </div>
                  <div className="radar-price">
                    <strong>{number(i.quote?.price)}</strong>
                    <small
                      className={Number(i.quote?.changePercent ?? 0) >= 0 ? 'positive' : 'negative'}
                    >
                      {Number(i.quote?.changePercent ?? 0) >= 0 ? '+' : ''}
                      {number(i.quote?.changePercent)}%
                    </small>
                  </div>
                </Link>
              ))}
            <Link className="text-link" href={href('watchlists')}>
              Crear mi watchlist <ArrowRight size={13} />
            </Link>
          </section>
        </aside>
      </div>
      <div className="dashboard-lower">
        <section className="panel movers-panel">
          <div className="panel-header">
            <div>
              <strong>Market movers</strong>
              <span className="panel-subtitle">Una selección para empezar a explorar</span>
            </div>
            <Link className="text-link" href={href('markets')}>
              Ver mercados <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="tabs compact-tabs">
            {['Destacados', 'Cripto', 'ETFs'].map((t) => (
              <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
                {t}
              </button>
            ))}
          </div>
          <MarketTable rows={filtered} compactView />
        </section>
        <section className="panel portfolio-teaser">
          <div className="panel-header">
            <strong>Tu portfolio</strong>
            <Wallet size={16} className="muted" />
          </div>
          <div className="portfolio-orbit">
            <div className="orbit-ring ring-1" />
            <div className="orbit-ring ring-2" />
            <div className="orbit-center">
              <MoveUpRight size={28} />
            </div>
            <span className="orbit-label orbit-label-1">USD</span>
            <span className="orbit-label orbit-label-2">ARS</span>
            <span className="orbit-label orbit-label-3">₿</span>
          </div>
          <h3>
            Cada inversión.
            <br />
            Una visión completa.
          </h3>
          <p>
            Acciones, cripto y CEDEARs.
            <br />
            Tu patrimonio, con su contexto.
          </p>
          <Link href={href('portfolio')} className="button button-secondary">
            {user ? 'Ver mi cartera' : 'Explorar portfolio'} <ArrowRight size={15} />
          </Link>
          <small>Con contabilidad FIFO y soporte multimoneda</small>
        </section>
      </div>
      <div className="world-strip">
        <span>
          <Globe2 size={16} /> Una perspectiva global. Una mirada local.
        </span>
        <p>
          Estados Unidos <i /> Criptomonedas <i /> Argentina & CEDEARs
        </p>
        <Link href="/data-policy">
          Conocé las fuentes <ExternalLink size={12} />
        </Link>
      </div>
    </div>
  );
}
function CandlesIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 1v14M12 2v12" stroke="currentColor" />
      <rect x="2" y="4" width="4" height="6" fill="var(--surface)" stroke="currentColor" />
      <rect x="10" y="6" width="4" height="5" fill="currentColor" />
    </svg>
  );
}
