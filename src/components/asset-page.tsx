'use client';
import { useState } from 'react';
import { Star, Maximize2, ArrowLeft, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { useApp } from './app-shell';
import type { Instrument } from '@/lib/market/types';
import { Button, AssetIcon, EmptyState } from './ui';
import { AssetIntelligence } from './asset-intelligence';
import { ChartWorkspace } from './chart-workspace';
import { Analyst } from './analyst';
import { News } from './news';
import { WatchlistPicker } from './watchlists';
import { CedearRatio } from './cedear-ratio';
import { FinancialStatementsPanel } from './financial-statements';
export function AssetPage({ instrument }: { instrument: Instrument }) {
  const { href } = useApp();
  const [tab, setTab] = useState('Overview');
  const [watchOpen, setWatchOpen] = useState(false);
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
          <Button onClick={() => setTab('Chart')}>
            <Maximize2 size={15} /> Ver gráfico
          </Button>
        </div>
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
      {tab === 'Overview' && (
        <AssetIntelligence
          instrument={instrument}
          onChart={() => setTab('Chart')}
          onFinancials={() => setTab('Financials')}
        />
      )}
      {tab === 'Chart' && (
        <>
          <Button variant="ghost" onClick={() => setTab('Overview')}>
            <ArrowLeft size={14} /> Volver al resumen
          </Button>
          <ChartWorkspace initialId={instrument.id} embedded />
        </>
      )}
      {tab === 'Financials' && <FinancialStatementsPanel instrument={instrument} />}
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
      <WatchlistPicker instrumentId={instrument.id} open={watchOpen} onOpenChange={setWatchOpen} />
    </>
  );
}
