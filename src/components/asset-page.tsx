'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Star, Sparkles, ArrowLeft, ExternalLink, ArrowUpRight, CircleHelp } from 'lucide-react';
import Link from 'next/link';
import { useApp } from './app-shell';
import type { Fundamental, Instrument, MarketSnapshot, Provenance } from '@/lib/market/types';
import { api, number, dateLabel, dateTimeLabel } from '@/lib/utils';
import { Button, AssetIcon, DataBadge, EmptyState, ErrorState, Tip } from './ui';
import { ChartWorkspace } from './chart-workspace';
import { Analyst } from './analyst';
import { News } from './news';
import { WatchlistPicker } from './watchlists';
import { CedearRatio } from './cedear-ratio';
export function AssetPage({ instrument }: { instrument: Instrument }) {
  const { demo, href } = useApp();
  const [tab, setTab] = useState('Overview');
  const [watchOpen, setWatchOpen] = useState(false);
  const quote = useQuery({
    queryKey: ['market', instrument.id, '1D', demo],
    queryFn: () =>
      api<MarketSnapshot>(
        `market?id=${encodeURIComponent(instrument.id)}${demo ? '&demo=true' : ''}`,
      ),
  });
  const fundamentals = useQuery({
    queryKey: ['fundamentals', instrument.id, demo],
    queryFn: () =>
      api<{ metrics: Fundamental[]; provenance?: Provenance; error?: string }>(
        `fundamentals?id=${encodeURIComponent(instrument.id)}${demo ? '&demo=true' : ''}`,
      ),
  });
  const q = quote.data?.quote;
  return (
    <>
      <Link className="breadcrumb" href={href('markets')}>
        <ArrowLeft size={13} /> Markets <span>/</span> {instrument.exchange} <span>/</span>{' '}
        {instrument.symbol}
      </Link>
      <div className="asset-profile-header">
        <div className="asset-cell">
          <AssetIcon instrument={instrument} />
          <div>
            <div className="eyebrow">
              {instrument.exchange} · {instrument.sector} · {instrument.type.toUpperCase()}
            </div>
            <h1>{instrument.name}</h1>
            <small>
              {instrument.symbol} · Cotiza en {instrument.currency}
            </small>
          </div>
        </div>
        <div className="inline-actions">
          <Button variant="secondary" onClick={() => setWatchOpen(true)}>
            <Star size={15} /> Seguir
          </Button>
          <Button onClick={() => setTab('AI Analysis')}>
            <Sparkles size={15} /> Analyze with AI
          </Button>
        </div>
      </div>
      <div className="asset-profile-price">
        <strong>
          {number(q?.price)} <small>{instrument.currency}</small>
        </strong>
        <span className={Number(q?.changePercent ?? 0) >= 0 ? 'positive' : 'negative'}>
          {Number(q?.changePercent ?? 0) >= 0 ? '+' : ''}
          {number(q?.changePercent)}%
        </span>
        <DataBadge status={q?.status ?? 'unavailable'} />
        <span className="muted">
          {q?.source ?? quote.data?.error ?? 'Cargando'} · {dateTimeLabel(q?.asOf ?? '')}
        </span>
      </div>
      {instrument.type === 'cedear' && (
        <div className="info-strip">
          Especie BYMA independiente · Subyacente: {instrument.underlyingId} · El precio corresponde
          a un certificado. Los ratios reales requieren un registro vigente y una fuente autorizada;
          no se asume un ratio.
        </div>
      )}
      {instrument.type === 'cedear' && <CedearRatio instrumentId={instrument.id} />}
      {instrument.type === 'crypto' && (
        <div className="info-strip">
          Par spot cotizado en USDT. USDT es una stablecoin y no se trata como USD en las
          conversiones de cartera.
        </div>
      )}
      <div className="tabs asset-tabs">
        {['Overview', 'Chart', 'Financials', 'Valuation', 'News', 'AI Analysis'].map((t) => (
          <button className={tab === t ? 'active' : ''} key={t} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      {(tab === 'Overview' || tab === 'Chart') && (
        <>
          <ChartWorkspace initialId={instrument.id} embedded />
          {tab === 'Overview' && (
            <section className="panel fundamental-section">
              <div className="panel-header">
                <strong>
                  {instrument.type === 'crypto'
                    ? 'Información del mercado spot'
                    : 'Métricas fundamentales'}
                </strong>
                <Tip text="Los valores ausentes no se completan con estimaciones ni se confunden con cero.">
                  <button className="icon-button" aria-label="Información sobre métricas">
                    <CircleHelp size={16} />
                  </button>
                </Tip>
              </div>
              {fundamentals.data?.metrics.length ? (
                <div className="fundamental-grid">
                  {fundamentals.data.metrics.map((m) => (
                    <div key={m.label}>
                      <small>{m.label}</small>
                      <strong>
                        {m.value === null ? '—' : number(m.value)} <span>{m.unit}</span>
                      </strong>
                      <small>{m.period}</small>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title={
                    instrument.type === 'crypto'
                      ? 'Métricas bursátiles no aplicables.'
                      : 'La evidencia viene primero.'
                  }
                >
                  {fundamentals.data?.error ??
                    'Conectá un proveedor de fundamentales para consultar métricas verificadas.'}
                </EmptyState>
              )}
              {fundamentals.data?.provenance && (
                <div className="chart-source">
                  {fundamentals.data.provenance.source} · Consultado{' '}
                  {dateLabel(fundamentals.data.provenance.retrievedAt)}
                </div>
              )}
            </section>
          )}
        </>
      )}
      {tab === 'Financials' && (
        <EmptyState
          title="Estados financieros con trazabilidad."
          action={
            <a
              className="button button-secondary"
              href="https://www.sec.gov/edgar/search/"
              target="_blank"
              rel="noreferrer"
            >
              Consultar SEC EDGAR <ExternalLink size={14} />
            </a>
          }
        >
          La ingesta de balances, conciliación fiscal y períodos comparables está pendiente. No se
          muestran cifras sin un estado financiero verificable.
        </EmptyState>
      )}
      {tab === 'Valuation' && (
        <EmptyState
          title="Una valuación necesita supuestos."
          action={
            <Button variant="secondary" onClick={() => setTab('Overview')}>
              Ver métricas disponibles <ArrowUpRight size={14} />
            </Button>
          }
        >
          El modelo DCF y los comparables sectoriales están pendientes. No se estima un precio
          objetivo sin flujos de caja, estructura de capital y supuestos explícitos.
        </EmptyState>
      )}
      {tab === 'News' && <News instrumentId={instrument.id} embedded />}
      {tab === 'AI Analysis' && <Analyst instrumentId={instrument.id} embedded />}
      {quote.isError && <ErrorState message={quote.error.message} />}
      <WatchlistPicker instrumentId={instrument.id} open={watchOpen} onOpenChange={setWatchOpen} />
    </>
  );
}
