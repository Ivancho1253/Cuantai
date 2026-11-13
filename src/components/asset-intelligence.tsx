'use client';
import { useText as useUiText } from './locale-provider';
import { useQuery } from '@tanstack/react-query';
import { Activity, Shield, Building2, Maximize2, RefreshCw, ArrowUpRight } from 'lucide-react';
import { useApp } from './app-shell';
import { Button, Skeleton, ErrorState } from './ui';
import { api, number, dateLabel, dateTimeLabel, cn } from '@/lib/utils';
import type { Instrument } from '@/lib/market/types';
import type { AssetOverview } from '@/lib/finance/asset-overview';
import { TradingViewChart } from './tradingview-chart';
import { tradingViewSymbol } from '@/lib/market/tradingview';
import { AssetChat } from './asset-chat';
import { News } from './news';
export function AssetIntelligence({
  instrument,
  onChart,
  onFinancials,
}: {
  instrument: Instrument;
  onChart: () => void;
  onFinancials: () => void;
}) {
  const uiText = useUiText();
  const { demo } = useApp();
  const query = useQuery({
    queryKey: ['asset-overview', instrument.id, demo],
    queryFn: () =>
      api<AssetOverview>(
        `asset-overview?id=${encodeURIComponent(instrument.id)}${demo ? '&demo=true' : ''}`,
      ),
    staleTime: 60000,
  });
  const data = query.data;
  return (
    <div className="asset-intelligence">
      <div className="asset-section-heading">
        <div>
          <span className="eyebrow">{uiText('PANORAMA DEL ACTIVO')}</span>
          <h2>{uiText('Todo lo que necesit\u00E1s para investigar.')}</h2>
        </div>
        <Button variant="ghost" onClick={() => query.refetch()} disabled={query.isFetching}>
          <RefreshCw size={13} />
          {uiText(' Actualizar datos')}
        </Button>
      </div>
      {uiText(query.isError && <ErrorState message={query.error.message} />)}
      {uiText(query.isPending && <Skeleton className="asset-overview-skeleton" />)}
      {uiText(
        data && (
          <>
            <div className="asset-data-note">
              <span className="badge">
                {uiText(
                  data.demo
                    ? 'SIMULACIÓN · NO ES MERCADO ACTUAL'
                    : data.stale
                      ? 'HISTÓRICO DESACTUALIZADO'
                      : 'DATOS DEL PROVEEDOR',
                )}
              </span>
              <span>
                {uiText(data.provenance.source)}
                {uiText(' \u00B7 \u00DAltimo cierre')}
                {uiText(' ')}
                {uiText(data.dataAsOf ? dateLabel(data.dataAsOf) : 'no disponible')} ·{' '}
                {uiText(instrument.currency)}
              </span>
            </div>
            {uiText(data.error && <p className="info-strip">{uiText(data.error)}</p>)}
            <section className="asset-performance" aria-label={uiText('Rendimiento del activo')}>
              {uiText(
                data.performance.map((period) => (
                  <article className="panel performance-card" key={period.id}>
                    <span>{uiText(period.label)}</span>
                    <strong
                      className={cn(
                        period.value !== null &&
                          (period.value > 0 ? 'positive' : period.value < 0 ? 'negative' : ''),
                      )}
                    >
                      {uiText(
                        period.value === null
                          ? '—'
                          : `${period.value > 0 ? '+' : ''}${number(period.value)}%`,
                      )}
                    </strong>
                    <small>
                      {uiText(
                        period.value === null
                          ? period.reason
                          : `${dateLabel(period.from!)} → ${dateLabel(period.to!)}`,
                      )}
                    </small>
                  </article>
                )),
              )}
            </section>
            <details className="asset-methodology">
              <summary>{uiText('C\u00F3mo se calculan estos rendimientos')}</summary>
              <p>{uiText(data.methodology)}</p>
              <p>
                {uiText('Fuente:')}
                {uiText(' ')}
                <a href={data.provenance.url} target="_blank" rel="noreferrer">
                  {uiText(data.provenance.source)}
                </a>
                {uiText('. Ajuste:')}
                {uiText(' ')}
                {uiText(
                  data.provenance.adjusted === 'split'
                    ? 'splits'
                    : data.provenance.adjusted === 'unadjusted'
                      ? 'sin ajustar'
                      : 'no informado',
                )}
                {uiText('. Consultado ')}
                {uiText(dateTimeLabel(data.provenance.retrievedAt))}.
              </p>
            </details>
            <div className="asset-research-grid">
              <div className="asset-research-main">
                <div className="asset-conclusions">
                  <section
                    className="panel asset-conclusion"
                    aria-label={uiText('Conclusi\u00F3n del an\u00E1lisis t\u00E9cnico')}
                  >
                    <div className="panel-header">
                      <strong>
                        <Activity size={16} />
                        {uiText(' An\u00E1lisis t\u00E9cnico')}
                      </strong>
                      <span className="eyebrow">{uiText('REGLAS EXPL\u00CDCITAS')}</span>
                    </div>
                    <div className="asset-card-body">
                      <h3>{uiText(data.technical.title)}</h3>
                      <p>{uiText(data.technical.conclusion)}</p>
                      <dl className="asset-mini-metrics">
                        <div>
                          <dt>{uiText('RSI \u00B7 14')}</dt>
                          <dd>{uiText(number(data.technical.metrics?.rsi))}</dd>
                        </div>
                        <div>
                          <dt>{uiText('EMA \u00B7 20')}</dt>
                          <dd>{uiText(number(data.technical.metrics?.ema20))}</dd>
                        </div>
                        <div>
                          <dt>{uiText('EMA \u00B7 50')}</dt>
                          <dd>{uiText(number(data.technical.metrics?.ema50))}</dd>
                        </div>
                      </dl>
                      <small>
                        {uiText('Calculado en Cuantai \u00B7 cierres diarios \u00B7 hasta')}
                        {uiText(' ')}
                        {uiText(data.dataAsOf ? dateLabel(data.dataAsOf) : 'sin fecha')}.
                      </small>
                    </div>
                  </section>
                  <section
                    className="panel asset-conclusion"
                    aria-label={uiText('Conclusi\u00F3n del an\u00E1lisis fundamental')}
                  >
                    <div className="panel-header">
                      <strong>
                        <Building2 size={16} />
                        {uiText(' An\u00E1lisis fundamental')}
                      </strong>
                    </div>
                    <div className="asset-card-body">
                      <h3>{uiText(data.fundamental.title)}</h3>
                      <p>{uiText(data.fundamental.conclusion)}</p>
                      {uiText(
                        data.fundamental.issuerName && (
                          <small>
                            {uiText('Emisor: ')}
                            {uiText(data.fundamental.issuerName)}
                            {uiText(' \u00B7 ejercicio')}
                            {uiText(' ')}
                            {uiText(dateLabel(data.fundamental.period!))}.{uiText(' ')}
                            {uiText(
                              instrument.type === 'cedear' &&
                                'Estados del subyacente en USD; no del certificado.',
                            )}
                          </small>
                        ),
                      )}
                      {uiText(
                        data.fundamental.error && <small>{uiText(data.fundamental.error)}</small>,
                      )}
                      {uiText(
                        data.fundamental.warnings.map((warning) => (
                          <small className="asset-warning" key={warning}>
                            {uiText(warning)}
                          </small>
                        )),
                      )}
                      <Button variant="ghost" onClick={onFinancials}>
                        {uiText('Ver estados financieros ')}
                        <ArrowUpRight size={13} />
                      </Button>
                    </div>
                  </section>
                </div>
                <section
                  className="panel asset-price-preview"
                  aria-label={uiText('Gr\u00E1fico peque\u00F1o de TradingView')}
                >
                  <div className="panel-header">
                    <div>
                      <strong>{uiText('Precio \u00B7 TradingView')}</strong>
                      <small className="panel-subtitle">
                        {uiText('Fuente independiente de las tarjetas de rendimiento.')}
                      </small>
                    </div>
                    <Button variant="secondary" onClick={onChart}>
                      <Maximize2 size={14} />
                      {uiText(' Ver gr\u00E1fico')}
                    </Button>
                  </div>
                  <TradingViewChart
                    symbol={tradingViewSymbol(instrument)}
                    chartType="area"
                    height={300}
                  />
                </section>
                <section className="panel asset-risk" aria-label={uiText('Riesgo del activo')}>
                  <div className="panel-header">
                    <strong>
                      <Shield size={16} />
                      {uiText(' Riesgo del activo')}
                    </strong>
                    <span className="badge">{uiText(data.risk.label)}</span>
                  </div>
                  <div className="asset-card-body">
                    <p>{uiText(data.risk.conclusion)}</p>
                    <dl className="asset-mini-metrics">
                      <div>
                        <dt>{uiText('Volatilidad anualizada')}</dt>
                        <dd>
                          {uiText(number(data.risk.volatility))}
                          {uiText(data.risk.volatility !== null && '%')}
                        </dd>
                      </div>
                      <div>
                        <dt>{uiText('Ca\u00EDda m\u00E1xima de la muestra')}</dt>
                        <dd>
                          {uiText(number(data.risk.maxDrawdown))}
                          {uiText(data.risk.maxDrawdown !== null && '%')}
                        </dd>
                      </div>
                      <div>
                        <dt>{uiText('Cierres en la muestra')}</dt>
                        <dd>{uiText(data.risk.observations)}</dd>
                      </div>
                    </dl>
                    <ul>
                      {uiText(
                        data.risk.factors.map((factor) => <li key={factor}>{uiText(factor)}</li>),
                      )}
                    </ul>
                    <details className="asset-methodology">
                      <summary>{uiText('Ventana y criterio de volatilidad')}</summary>
                      <p>
                        {uiText('\u00DAltimos ')}
                        {uiText(instrument.type === 'crypto' ? '366' : '253')}
                        {uiText(
                          ' cierres disponibles; m\u00EDnimo 60 variaciones. Desv\u00EDo muestral de retornos logar\u00EDtmicos por ra\u00EDz de',
                        )}
                        {uiText(' ')}
                        {uiText(instrument.type === 'crypto' ? '365' : '252')}
                        {uiText(
                          ', expresado en porcentaje. Baja: menos de 20%; intermedia: de 20% a menos de 40%; alta: desde 40%. Umbrales descriptivos de Cuantai; no son una calificaci\u00F3n integral de riesgo. Ventana observada: ',
                        )}
                        {uiText(data.risk.from ? dateLabel(data.risk.from) : '—')}
                        {uiText(' a')}
                        {uiText(' ')}
                        {uiText(data.risk.to ? dateLabel(data.risk.to) : '—')}.
                      </p>
                    </details>
                  </div>
                </section>
                <section className="panel" aria-label={uiText('Datos clave del activo')}>
                  <div className="panel-header">
                    <strong>{uiText('Datos clave')}</strong>
                  </div>
                  <div className="asset-key-data">
                    <dl>
                      <div>
                        <dt>{uiText('Mercado')}</dt>
                        <dd>{uiText(instrument.exchange)}</dd>
                      </div>
                      <div>
                        <dt>{uiText('Moneda')}</dt>
                        <dd>{uiText(instrument.currency)}</dd>
                      </div>
                      <div>
                        <dt>{uiText('Sector')}</dt>
                        <dd>{uiText(instrument.sector)}</dd>
                      </div>
                      <div>
                        <dt>{uiText('Pa\u00EDs')}</dt>
                        <dd>{uiText(instrument.country)}</dd>
                      </div>
                      <div>
                        <dt>{uiText('\u00DAltima cotizaci\u00F3n disponible')}</dt>
                        <dd>
                          {uiText(
                            data.quote
                              ? `${number(data.quote.price)} ${instrument.currency}`
                              : 'Sin cotización',
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>{uiText('Fuente y fecha de cotizaci\u00F3n')}</dt>
                        <dd>
                          {uiText(
                            data.quote
                              ? `${data.quote.source} · ${dateTimeLabel(data.quote.asOf)}${data.quote.stale ? ' · desactualizada' : ''}`
                              : 'Sin proveedor disponible',
                          )}
                        </dd>
                      </div>
                    </dl>
                  </div>
                  {uiText(
                    data.fundamentals.metrics.length > 0 ? (
                      <div className="fundamental-grid">
                        {uiText(
                          data.fundamentals.metrics.map((metric) => (
                            <div key={metric.label}>
                              <small>{uiText(metric.label)}</small>
                              <strong>
                                {uiText(number(metric.value))} <span>{uiText(metric.unit)}</span>
                              </strong>
                              <small>{uiText(metric.period)}</small>
                            </div>
                          )),
                        )}
                      </div>
                    ) : (
                      <p className="asset-chat-intro">{uiText(data.fundamentals.error)}</p>
                    ),
                  )}
                  {uiText(
                    data.fundamentals.provenance && (
                      <p className="asset-chat-intro">
                        {uiText(data.fundamentals.provenance.source)}
                        {uiText(' \u00B7 Consultado')}
                        {uiText(' ')}
                        {uiText(dateLabel(data.fundamentals.provenance.retrievedAt))}
                      </p>
                    ),
                  )}
                </section>
              </div>
              <aside className="asset-research-aside">
                <AssetChat key={`${instrument.id}:${demo}`} overview={data} />
                <News instrumentId={instrument.id} embedded compact />
              </aside>
            </div>
            <details className="asset-methodology">
              <summary>{uiText('Fuentes de esta ficha')}</summary>
              {uiText(
                data.sources.map((source) => (
                  <p key={source.id}>
                    <a href={source.url} target="_blank" rel="noreferrer">
                      {uiText(source.title)}
                    </a>
                    {uiText(' ')}
                    {uiText('\u00B7 dato ')}
                    {uiText(dateLabel(source.asOf))}
                    {uiText(' \u00B7 consultado ')}
                    {uiText(dateLabel(source.retrievedAt))}
                  </p>
                )),
              )}
            </details>
          </>
        ),
      )}
      {uiText(
        query.isError && (
          <Button variant="secondary" onClick={() => query.refetch()}>
            {uiText('Reintentar resumen')}
          </Button>
        ),
      )}
    </div>
  );
}
