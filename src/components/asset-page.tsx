'use client';
import { useText as useUiText } from './locale-provider';
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
  const uiText = useUiText();
  const { href } = useApp();
  const [tab, setTab] = useState('Overview');
  const [watchOpen, setWatchOpen] = useState(false);
  return (
    <>
      <Link className="breadcrumb" href={href('markets')}>
        <ArrowLeft size={13} />
        {uiText(' Markets ')}
        <span>/</span> {uiText(instrument.exchange)} <span>/</span>
        {uiText(' ')}
        {uiText(instrument.symbol)}
      </Link>
      <div className="asset-profile-header">
        <div className="asset-cell">
          <AssetIcon instrument={instrument} />
          <div>
            <div className="eyebrow">
              {uiText(instrument.exchange)} · {uiText(instrument.sector)} ·{' '}
              {uiText(instrument.type.toUpperCase())}
            </div>
            <h1>{uiText(instrument.name)}</h1>
            <small>
              {uiText(instrument.symbol)}
              {uiText(' \u00B7 Cotiza en ')}
              {uiText(instrument.currency)}
            </small>
          </div>
        </div>
        <div className="inline-actions">
          <Button variant="secondary" onClick={() => setWatchOpen(true)}>
            <Star size={15} />
            {uiText(' Seguir')}
          </Button>
          <Button onClick={() => setTab('Chart')}>
            <Maximize2 size={15} />
            {uiText(' Ver gr\u00E1fico')}
          </Button>
        </div>
      </div>
      {uiText(
        instrument.type === 'cedear' && (
          <div className="info-strip">
            {uiText('Especie BYMA independiente \u00B7 Subyacente: ')}
            {uiText(instrument.underlyingId)}
            {uiText(
              ' \u00B7 El precio corresponde a un certificado. Los ratios reales requieren un registro vigente y una fuente autorizada; no se asume un ratio.',
            )}
          </div>
        ),
      )}
      {uiText(instrument.type === 'cedear' && <CedearRatio instrumentId={instrument.id} />)}
      {uiText(
        instrument.type === 'crypto' && (
          <div className="info-strip">
            {uiText(
              'Par spot cotizado en USDT. USDT es una stablecoin y no se trata como USD en las conversiones de cartera.',
            )}
          </div>
        ),
      )}
      <div className="tabs asset-tabs">
        {uiText(
          ['Overview', 'Chart', 'Financials', 'Valuation', 'News', 'AI Analysis'].map((t) => (
            <button className={tab === t ? 'active' : ''} key={t} onClick={() => setTab(t)}>
              {uiText(t)}
            </button>
          )),
        )}
      </div>
      {uiText(
        tab === 'Overview' && (
          <AssetIntelligence
            instrument={instrument}
            onChart={() => setTab('Chart')}
            onFinancials={() => setTab('Financials')}
          />
        ),
      )}
      {uiText(
        tab === 'Chart' && (
          <>
            <Button variant="ghost" onClick={() => setTab('Overview')}>
              <ArrowLeft size={14} />
              {uiText(' Volver al resumen')}
            </Button>
            <ChartWorkspace initialId={instrument.id} embedded />
          </>
        ),
      )}
      {uiText(tab === 'Financials' && <FinancialStatementsPanel instrument={instrument} />)}
      {uiText(
        tab === 'Valuation' && (
          <EmptyState
            title={uiText('Una valuaci\u00F3n necesita supuestos.')}
            action={
              <Button variant="secondary" onClick={() => setTab('Overview')}>
                {uiText('Ver m\u00E9tricas disponibles ')}
                <ArrowUpRight size={14} />
              </Button>
            }
          >
            {uiText(
              'El modelo DCF y los comparables sectoriales est\u00E1n pendientes. No se estima un precio objetivo sin flujos de caja, estructura de capital y supuestos expl\u00EDcitos.',
            )}
          </EmptyState>
        ),
      )}
      {uiText(tab === 'News' && <News instrumentId={instrument.id} embedded />)}
      {uiText(
        tab === 'AI Analysis' && (
          <Analyst
            key={instrument.id}
            instrumentId={instrument.id}
            initialInstrument={instrument}
            embedded
          />
        ),
      )}
      <WatchlistPicker instrumentId={instrument.id} open={watchOpen} onOpenChange={setWatchOpen} />
    </>
  );
}
