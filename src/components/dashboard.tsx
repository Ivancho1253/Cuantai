'use client';
import { useText as useUiText, useLocale } from './locale-provider';
import { useState } from 'react';
import Link from 'next/link';
import { assetHref } from '@/lib/market/asset-href';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight,
  ArrowRight,
  Sparkles,
  Plus,
  Globe2,
  ExternalLink,
  MoveUpRight,
  Wallet,
} from 'lucide-react';
import { useApp } from './app-shell';
import { api, cn } from '@/lib/utils';
import type { MarketSnapshot } from '@/lib/market/types';
import { TradingViewChart } from './tradingview-chart';
import { instruments } from '@/lib/market/catalog';
import { tradingViewSymbol } from '@/lib/market/tradingview';
import { MarketTable } from './market-table';
import { ErrorState, Skeleton, AssetIcon } from './ui';
import { RollingNumber } from './rolling-number';
const benchmarks = [
  ['NYSE:SPY:USD', 'S&P 500', 'SPY · ETF proxy'],
  ['NASDAQ:QQQ:USD', 'Nasdaq-100', 'QQQ · ETF proxy'],
  ['NYSE:DIA:USD', 'Dow Jones', 'DIA · ETF proxy'],
  ['BINANCE:BTCUSDT:USDT', 'Bitcoin', 'BTC / USDT'],
];
export function Dashboard() {
  const uiText = useUiText();
  const { locale } = useLocale();
  const localeNumber = (value: string | null | undefined) =>
    value == null
      ? '—'
      : new Intl.NumberFormat(locale === 'en' ? 'en-US' : locale === 'pt' ? 'pt-BR' : 'es-AR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(Number(value));
  const { user, demo, href, openSearch } = useApp();
  const [selected, setSelected] = useState('NASDAQ:NVDA:USD');
  const [tab, setTab] = useState('Destacados');
  const overview = useQuery({
    queryKey: ['overview', demo],
    queryFn: () => api<MarketSnapshot[]>(`overview${demo ? '?demo=true' : ''}`),
  });
  const quotes = useQuery({
    queryKey: ['benchmarks', demo],
    queryFn: () => api<MarketSnapshot[]>(`benchmarks${demo ? '?demo=true' : ''}`),
    refetchInterval: 10000,
    refetchIntervalInBackground: false,
    staleTime: 10000,
  });
  const selectedInstrument = instruments.find((i) => i.id === selected);
  const data = overview.data ?? [];
  const filtered =
    tab === 'Cripto'
      ? data.filter((d) => d.instrument.type === 'crypto')
      : tab === 'ETFs'
        ? data.filter((d) => d.instrument.type === 'etf')
        : data.filter((d) => d.instrument.type === 'stock').slice(0, 6);
  return (
    <div className="dashboard-page">
      <div className="overview-heading">
        <div>
          <div className="eyebrow">
            <span className="tiny-line" />
            {uiText(' TU VENTAJA EMPIEZA CON CLARIDAD')}
          </div>
          <h1>
            {uiText('El mercado, en perspectiva')}
            <span>.</span>
          </h1>
          <p>
            {user ? uiText('Hola, {0}. ', [user.name.split(' ')[0]]) : ''}
            {uiText('Tu universo de inversi\u00F3n, conectado en un solo lugar.')}
          </p>
        </div>
        <div className="dashboard-actions">
          <Link className="button button-primary portfolio-primary" href={href('portfolio')}>
            <Wallet size={19} />
            {uiText(user ? 'Ver mi cartera' : 'Explorar portfolio')}
            <ArrowUpRight size={17} />
          </Link>
          <Link className="button button-secondary" href={href('charts')}>
            <CandlesIcon />
            {uiText(' Abrir terminal ')}
            <ArrowUpRight size={15} />
          </Link>
        </div>
      </div>
      <div className="benchmark-refresh">
        <span className={quotes.isFetching ? 'refresh-dot fetching' : 'refresh-dot'} />
        {uiText(
          demo
            ? 'Vista demo · valores de ejemplo'
            : 'Consulta cada 10 s · disponibilidad según la fuente',
        )}
      </div>
      <div className="benchmark-grid">
        {uiText(
          benchmarks.map(([id, name, sub]) => {
            const item = quotes.data?.find((d) => d.instrument.id === id);
            const up = Number(item?.quote?.changePercent ?? 0) >= 0;
            return (
              <button
                className={cn('benchmark-card', selected === id && 'selected')}
                key={id}
                onClick={() => setSelected(id)}
              >
                <div className="benchmark-top">
                  <span>{uiText(name)}</span>
                  <ArrowUpRight size={14} />
                </div>
                <div className="benchmark-value">
                  {uiText(
                    quotes.isPending ? (
                      <Skeleton className="price-skeleton" />
                    ) : (
                      <RollingNumber value={item?.quote?.price} />
                    ),
                  )}
                  <span className={cn('benchmark-change', up ? 'positive' : 'negative')}>
                    {uiText(
                      item?.quote
                        ? `${up ? '+' : ''}${localeNumber(item.quote.changePercent)}%`
                        : '—',
                    )}
                  </span>
                </div>
                <div className="benchmark-bottom">
                  <small>
                    {uiText(sub)} · {item?.instrument.currency ?? id.split(':')[2]}
                  </small>
                  <small className="muted">{uiText('Ver gr\u00E1fico')}</small>
                </div>
                <div className="benchmark-source">
                  {uiText(
                    item?.quote?.status === 'demo'
                      ? 'Demo'
                      : item?.quote?.status === 'realtime'
                        ? 'En vivo'
                        : item?.quote
                          ? 'Cotización indicativa'
                          : 'Sin cotización',
                  )}
                  {item?.quote?.asOf && (
                    <time dateTime={item.quote.asOf}>
                      {' '}
                      ·{' '}
                      {new Date(item.quote.asOf).toLocaleString(
                        locale === 'pt' ? 'pt-BR' : locale === 'en' ? 'en-US' : 'es-AR',
                        {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        },
                      )}
                    </time>
                  )}
                </div>
              </button>
            );
          }),
        )}
      </div>
      {uiText(
        overview.isError && (
          <ErrorState message={overview.error.message} retry={() => overview.refetch()} />
        ),
      )}
      <div className="dashboard-middle">
        <section className="panel main-chart-panel">
          <div className="panel-header">
            <div className="panel-heading">
              {uiText('Market overview ')}
              <span className="subtle-dot" />
              {uiText(' ')}
              <span className="muted normal-weight">{uiText('Tu foco de hoy')}</span>
            </div>
            <Link
              className="icon-button"
              href={href('charts')}
              aria-label={uiText('Expandir gr\u00E1fico')}
            >
              <ArrowUpRight size={18} />
            </Link>
          </div>
          <TradingViewChart
            instrumentId={selected}
            symbol={selectedInstrument ? tradingViewSymbol(selectedInstrument) : null}
            height={490}
          />
        </section>
        <aside className="insight-column">
          <section className="analyst-card">
            <div className="analyst-card-top">
              <span className="ai-icon">
                <Sparkles size={18} />
              </span>
              <span>{uiText('CUANTAI INTELLIGENCE')}</span>
              <span className="ai-small">{uiText('AI')}</span>
            </div>
            <h2>
              {uiText('Detr\u00E1s de cada movimiento,')}
              <br />
              <em>{uiText('hay una historia.')}</em>
            </h2>
            <p>
              {uiText(
                'Conect\u00E1 precio, tendencia y contexto. Transform\u00E1 los datos en una tesis que puedas entender.',
              )}
            </p>
            <div className="analysis-preview">
              <div>
                <span className="analysis-line" />
                {uiText(' Evidencia antes que conclusiones')}
              </div>
              <div>
                <span className="analysis-line purple" />
                {uiText(' Escenarios, riesgos y fuentes')}
              </div>
            </div>
            <Link href={href('analyst')} className="analyst-cta">
              {uiText('Explorar AI Analyst ')}
              <ArrowUpRight size={17} />
            </Link>
          </section>
          <section className="panel watch-preview">
            <div className="panel-header">
              <div>
                <strong>{uiText('En tu radar')}</strong>
                <p className="radar-caption">{uiText('Activos para seguir de cerca')}</p>
              </div>
              <button
                onClick={openSearch}
                className="icon-button"
                aria-label={uiText('Buscar activo')}
              >
                <Plus size={16} />
              </button>
            </div>
            {uiText(
              data
                .filter((i) => ['AAPL', 'JPM', 'ETHUSDT'].includes(i.instrument.symbol))
                .map((i) => (
                  <Link
                    href={assetHref(i.instrument, demo)}
                    className="radar-row"
                    key={i.instrument.id}
                  >
                    <AssetIcon instrument={i.instrument} />
                    <div className="radar-identity">
                      <strong>{uiText(i.instrument.symbol)}</strong>
                      <small title={i.instrument.name}>{i.instrument.name}</small>
                    </div>
                    <div className="radar-price">
                      <strong>{localeNumber(i.quote?.price)}</strong>
                      <small
                        className={
                          Number(i.quote?.changePercent ?? 0) >= 0 ? 'positive' : 'negative'
                        }
                      >
                        {i.quote
                          ? `${Number(i.quote.changePercent) >= 0 ? '+' : ''}${localeNumber(i.quote.changePercent)}%`
                          : '—'}
                      </small>
                    </div>
                  </Link>
                )),
            )}
            <Link className="text-link" href={href('watchlists')}>
              {uiText('Abrir seguimiento')}
              <ArrowRight size={17} />
            </Link>
          </section>
        </aside>
      </div>
      <div className="dashboard-lower">
        <section className="panel movers-panel">
          <div className="panel-header">
            <div>
              <strong>{uiText('Market movers')}</strong>
              <span className="panel-subtitle">
                {uiText('Una selecci\u00F3n para empezar a explorar')}
              </span>
            </div>
            <Link className="text-link" href={href('markets')}>
              {uiText('Ver mercados ')}
              <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="tabs compact-tabs">
            {uiText(
              ['Destacados', 'Cripto', 'ETFs'].map((t) => (
                <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
                  {uiText(t)}
                </button>
              )),
            )}
          </div>
          <MarketTable rows={filtered} compactView />
        </section>
        <section className="panel portfolio-teaser">
          <div className="panel-header">
            <strong>{uiText('Tu portfolio')}</strong>
            <Wallet size={16} className="muted" />
          </div>
          <div className="portfolio-orbit">
            <div className="orbit-ring ring-1" />
            <div className="orbit-ring ring-2" />
            <div className="orbit-center">
              <MoveUpRight size={28} />
            </div>
            <span className="orbit-label orbit-label-1">{uiText('USD')}</span>
            <span className="orbit-label orbit-label-2">{uiText('ARS')}</span>
            <span className="orbit-label orbit-label-3">₿</span>
          </div>
          <h3>
            {uiText('Cada inversi\u00F3n.')}
            <br />
            {uiText('Una visi\u00F3n completa.')}
          </h3>
          <p>
            {uiText('Acciones, cripto y CEDEARs.')}
            <br />
            {uiText('Tu patrimonio, con su contexto.')}
          </p>
          <Link href={href('portfolio')} className="button button-secondary">
            {uiText(user ? 'Ver mi cartera' : 'Explorar portfolio')} <ArrowRight size={15} />
          </Link>
          <small>{uiText('Con contabilidad FIFO y soporte multimoneda')}</small>
        </section>
      </div>
      <div className="world-strip">
        <span>
          <Globe2 size={16} />
          {uiText(' Una perspectiva global. Una mirada local.')}
        </span>
        <p>
          {uiText('Estados Unidos ')}
          <i />
          {uiText(' Criptomonedas ')}
          <i />
          {uiText(' Argentina & CEDEARs')}
        </p>
        <Link href="/data-policy">
          {uiText('Conoc\u00E9 las fuentes ')}
          <ExternalLink size={12} />
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
