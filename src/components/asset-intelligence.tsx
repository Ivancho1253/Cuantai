'use client';
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
          <span className="eyebrow">PANORAMA DEL ACTIVO</span>
          <h2>Todo lo que necesitás para investigar.</h2>
        </div>
        <Button variant="ghost" onClick={() => query.refetch()} disabled={query.isFetching}>
          <RefreshCw size={13} /> Actualizar datos
        </Button>
      </div>
      {query.isError && <ErrorState message={query.error.message} />}
      {query.isPending && <Skeleton className="asset-overview-skeleton" />}
      {data && (
        <>
          <div className="asset-data-note">
            <span className="badge">
              {data.demo
                ? 'SIMULACIÓN · NO ES MERCADO ACTUAL'
                : data.stale
                  ? 'HISTÓRICO DESACTUALIZADO'
                  : 'DATOS DEL PROVEEDOR'}
            </span>
            <span>
              {data.provenance.source} · Último cierre{' '}
              {data.dataAsOf ? dateLabel(data.dataAsOf) : 'no disponible'} · {instrument.currency}
            </span>
          </div>
          {data.error && <p className="info-strip">{data.error}</p>}
          <section className="asset-performance" aria-label="Rendimiento del activo">
            {data.performance.map((period) => (
              <article className="panel performance-card" key={period.id}>
                <span>{period.label}</span>
                <strong
                  className={cn(
                    period.value !== null &&
                      (period.value > 0 ? 'positive' : period.value < 0 ? 'negative' : ''),
                  )}
                >
                  {period.value === null
                    ? '—'
                    : `${period.value > 0 ? '+' : ''}${number(period.value)}%`}
                </strong>
                <small>
                  {period.value === null
                    ? period.reason
                    : `${dateLabel(period.from!)} → ${dateLabel(period.to!)}`}
                </small>
              </article>
            ))}
          </section>
          <details className="asset-methodology">
            <summary>Cómo se calculan estos rendimientos</summary>
            <p>{data.methodology}</p>
            <p>
              Fuente:{' '}
              <a href={data.provenance.url} target="_blank" rel="noreferrer">
                {data.provenance.source}
              </a>
              . Ajuste:{' '}
              {data.provenance.adjusted === 'split'
                ? 'splits'
                : data.provenance.adjusted === 'unadjusted'
                  ? 'sin ajustar'
                  : 'no informado'}
              . Consultado {dateTimeLabel(data.provenance.retrievedAt)}.
            </p>
          </details>
          <div className="asset-research-grid">
            <div className="asset-research-main">
              <div className="asset-conclusions">
                <section
                  className="panel asset-conclusion"
                  aria-label="Conclusión del análisis técnico"
                >
                  <div className="panel-header">
                    <strong>
                      <Activity size={16} /> Análisis técnico
                    </strong>
                    <span className="eyebrow">REGLAS EXPLÍCITAS</span>
                  </div>
                  <div className="asset-card-body">
                    <h3>{data.technical.title}</h3>
                    <p>{data.technical.conclusion}</p>
                    <dl className="asset-mini-metrics">
                      <div>
                        <dt>RSI · 14</dt>
                        <dd>{number(data.technical.metrics?.rsi)}</dd>
                      </div>
                      <div>
                        <dt>EMA · 20</dt>
                        <dd>{number(data.technical.metrics?.ema20)}</dd>
                      </div>
                      <div>
                        <dt>EMA · 50</dt>
                        <dd>{number(data.technical.metrics?.ema50)}</dd>
                      </div>
                    </dl>
                    <small>
                      Calculado en Cuantai · cierres diarios · hasta{' '}
                      {data.dataAsOf ? dateLabel(data.dataAsOf) : 'sin fecha'}.
                    </small>
                  </div>
                </section>
                <section
                  className="panel asset-conclusion"
                  aria-label="Conclusión del análisis fundamental"
                >
                  <div className="panel-header">
                    <strong>
                      <Building2 size={16} /> Análisis fundamental
                    </strong>
                  </div>
                  <div className="asset-card-body">
                    <h3>{data.fundamental.title}</h3>
                    <p>{data.fundamental.conclusion}</p>
                    {data.fundamental.issuerName && (
                      <small>
                        Emisor: {data.fundamental.issuerName} · ejercicio{' '}
                        {dateLabel(data.fundamental.period!)}.{' '}
                        {instrument.type === 'cedear' &&
                          'Estados del subyacente en USD; no del certificado.'}
                      </small>
                    )}
                    {data.fundamental.error && <small>{data.fundamental.error}</small>}
                    {data.fundamental.warnings.map((warning) => (
                      <small className="asset-warning" key={warning}>
                        {warning}
                      </small>
                    ))}
                    <Button variant="ghost" onClick={onFinancials}>
                      Ver estados financieros <ArrowUpRight size={13} />
                    </Button>
                  </div>
                </section>
              </div>
              <section
                className="panel asset-price-preview"
                aria-label="Gráfico pequeño de TradingView"
              >
                <div className="panel-header">
                  <div>
                    <strong>Precio · TradingView</strong>
                    <small className="panel-subtitle">
                      Fuente independiente de las tarjetas de rendimiento.
                    </small>
                  </div>
                  <Button variant="secondary" onClick={onChart}>
                    <Maximize2 size={14} /> Ver gráfico
                  </Button>
                </div>
                <TradingViewChart
                  symbol={tradingViewSymbol(instrument)}
                  chartType="area"
                  height={300}
                />
              </section>
              <section className="panel asset-risk" aria-label="Riesgo del activo">
                <div className="panel-header">
                  <strong>
                    <Shield size={16} /> Riesgo del activo
                  </strong>
                  <span className="badge">{data.risk.label}</span>
                </div>
                <div className="asset-card-body">
                  <p>{data.risk.conclusion}</p>
                  <dl className="asset-mini-metrics">
                    <div>
                      <dt>Volatilidad anualizada</dt>
                      <dd>
                        {number(data.risk.volatility)}
                        {data.risk.volatility !== null && '%'}
                      </dd>
                    </div>
                    <div>
                      <dt>Caída máxima de la muestra</dt>
                      <dd>
                        {number(data.risk.maxDrawdown)}
                        {data.risk.maxDrawdown !== null && '%'}
                      </dd>
                    </div>
                    <div>
                      <dt>Cierres en la muestra</dt>
                      <dd>{data.risk.observations}</dd>
                    </div>
                  </dl>
                  <ul>
                    {data.risk.factors.map((factor) => (
                      <li key={factor}>{factor}</li>
                    ))}
                  </ul>
                  <details className="asset-methodology">
                    <summary>Ventana y criterio de volatilidad</summary>
                    <p>
                      Últimos {instrument.type === 'crypto' ? '366' : '253'} cierres disponibles;
                      mínimo 60 variaciones. Desvío muestral de retornos logarítmicos por raíz de{' '}
                      {instrument.type === 'crypto' ? '365' : '252'}, expresado en porcentaje. Baja:
                      menos de 20%; intermedia: de 20% a menos de 40%; alta: desde 40%. Umbrales
                      descriptivos de Cuantai; no son una calificación integral de riesgo. Ventana
                      observada: {data.risk.from ? dateLabel(data.risk.from) : '—'} a{' '}
                      {data.risk.to ? dateLabel(data.risk.to) : '—'}.
                    </p>
                  </details>
                </div>
              </section>
              <section className="panel" aria-label="Datos clave del activo">
                <div className="panel-header">
                  <strong>Datos clave</strong>
                </div>
                <div className="asset-key-data">
                  <dl>
                    <div>
                      <dt>Mercado</dt>
                      <dd>{instrument.exchange}</dd>
                    </div>
                    <div>
                      <dt>Moneda</dt>
                      <dd>{instrument.currency}</dd>
                    </div>
                    <div>
                      <dt>Sector</dt>
                      <dd>{instrument.sector}</dd>
                    </div>
                    <div>
                      <dt>País</dt>
                      <dd>{instrument.country}</dd>
                    </div>
                    <div>
                      <dt>Última cotización disponible</dt>
                      <dd>
                        {data.quote
                          ? `${number(data.quote.price)} ${instrument.currency}`
                          : 'Sin cotización'}
                      </dd>
                    </div>
                    <div>
                      <dt>Fuente y fecha de cotización</dt>
                      <dd>
                        {data.quote
                          ? `${data.quote.source} · ${dateTimeLabel(data.quote.asOf)}${data.quote.stale ? ' · desactualizada' : ''}`
                          : 'Sin proveedor disponible'}
                      </dd>
                    </div>
                  </dl>
                </div>
                {data.fundamentals.metrics.length > 0 ? (
                  <div className="fundamental-grid">
                    {data.fundamentals.metrics.map((metric) => (
                      <div key={metric.label}>
                        <small>{metric.label}</small>
                        <strong>
                          {number(metric.value)} <span>{metric.unit}</span>
                        </strong>
                        <small>{metric.period}</small>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="asset-chat-intro">{data.fundamentals.error}</p>
                )}
                {data.fundamentals.provenance && (
                  <p className="asset-chat-intro">
                    {data.fundamentals.provenance.source} · Consultado{' '}
                    {dateLabel(data.fundamentals.provenance.retrievedAt)}
                  </p>
                )}
              </section>
            </div>
            <aside className="asset-research-aside">
              <AssetChat key={`${instrument.id}:${demo}`} overview={data} />
              <News instrumentId={instrument.id} embedded compact />
            </aside>
          </div>
          <details className="asset-methodology">
            <summary>Fuentes de esta ficha</summary>
            {data.sources.map((source) => (
              <p key={source.id}>
                <a href={source.url} target="_blank" rel="noreferrer">
                  {source.title}
                </a>{' '}
                · dato {dateLabel(source.asOf)} · consultado {dateLabel(source.retrievedAt)}
              </p>
            ))}
          </details>
        </>
      )}
      {query.isError && (
        <Button variant="secondary" onClick={() => query.refetch()}>
          Reintentar resumen
        </Button>
      )}
    </div>
  );
}
