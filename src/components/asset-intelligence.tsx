'use client';
import { useText, useLocale } from './locale-provider';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Shield,
  Building2,
  Maximize2,
  RefreshCw,
  ArrowUpRight,
  MessageSquare,
  Newspaper,
} from 'lucide-react';
import { useApp } from './app-shell';
import { Button, Skeleton, ErrorState, DataBadge } from './ui';
import { api, dateLabel, cn } from '@/lib/utils';
import type { Instrument } from '@/lib/market/types';
import type { AssetOverview } from '@/lib/finance/asset-overview';
import { TradingViewChart } from './tradingview-chart';
import { tradingViewSymbol } from '@/lib/market/tradingview';
import { AssetChat } from './asset-chat';
import { News } from './news';
import { TechnicalGauge } from './technical-gauge';
import { ChartIndicators } from './chart-indicators';

export function AssetIntelligence({
  instrument,
  onChart,
  onFinancials,
}: {
  instrument: Instrument;
  onChart: () => void;
  onFinancials: () => void;
}) {
  const t = useText();
  const { locale } = useLocale();
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
  const language = locale === 'en' ? 'en-US' : locale === 'pt' ? 'pt-BR' : 'es-AR';
  const format = (value: number | string | null | undefined, compact = false) =>
    value == null
      ? '—'
      : new Intl.NumberFormat(language, {
          minimumFractionDigits: compact ? 0 : 2,
          maximumFractionDigits: 2,
          ...(compact ? { notation: 'compact' as const } : {}),
        }).format(Number(value));
  const financialFacts =
    data?.facts
      .filter(
        (f) =>
          ['net-income', 'operating-cash-flow', 'revenue-growth'].includes(f.id) ||
          f.id.startsWith('fundamental-'),
      )
      .slice(0, 6) ?? [];
  return (
    <div className="asset-intelligence asset-priority-layout">
      <section
        className="panel asset-chart-hero"
        id="asset-price"
        aria-label={t('Gráfico principal del activo')}
      >
        <div className="asset-chart-heading">
          <div>
            <span className="asset-overline">{t('PRECIO Y MOVIMIENTO')}</span>
            <h2>
              {instrument.symbol}
              <span>
                {instrument.exchange} · {instrument.currency}
              </span>
            </h2>
          </div>
          <div className="asset-chart-shortcuts">
            <a href="#asset-chat">
              <MessageSquare size={17} />
              {t('Consultar a la IA')}
            </a>
            <a href="#asset-news">
              <Newspaper size={17} />
              {t('Ver noticias')}
            </a>
            <Button variant="secondary" onClick={onChart}>
              <Maximize2 size={17} />
              {t('Abrir terminal')}
            </Button>
          </div>
        </div>
        <TradingViewChart symbol={tradingViewSymbol(instrument)} chartType="candles" height={680} />
      </section>
      <div className="asset-pulse-row">
        <TechnicalGauge instrumentId={instrument.id} />
        <section className="panel asset-returns-panel" aria-label={t('Rendimiento del activo')}>
          <div className="asset-detail-heading">
            <div>
              <span className="asset-overline">{t('EVOLUCIÓN')}</span>
              <h2>{t('Rendimiento en perspectiva')}</h2>
            </div>
            <Button variant="ghost" onClick={() => query.refetch()} disabled={query.isFetching}>
              <RefreshCw size={16} />
              {t('Actualizar datos')}
            </Button>
          </div>
          {query.isPending ? (
            <Skeleton className="asset-overview-skeleton" />
          ) : query.isError ? (
            <ErrorState message={query.error.message} retry={() => query.refetch()} />
          ) : (
            data && (
              <>
                <div className="asset-data-note">
                  <DataBadge status={data.provenance.status} />
                  <span>
                    {data.provenance.source} · {t('Último cierre')}:{' '}
                    {data.dataAsOf ? dateLabel(data.dataAsOf, locale) : t('no disponible')}
                  </span>
                  {data.stale && <span className="negative">{t('Histórico desactualizado')}</span>}
                </div>
                <div className="asset-performance">
                  {data.performance.map((period) => (
                    <article className="performance-card" key={period.id}>
                      <span>{t(period.label)}</span>
                      <strong
                        className={cn(
                          period.value !== null &&
                            (period.value > 0 ? 'positive' : period.value < 0 ? 'negative' : ''),
                        )}
                      >
                        {period.value === null
                          ? '—'
                          : `${period.value > 0 ? '+' : ''}${format(period.value)}%`}
                      </strong>
                      <small>
                        {period.value === null
                          ? t(period.reason)
                          : `${dateLabel(period.from!, locale)} → ${dateLabel(period.to!, locale)}`}
                      </small>
                    </article>
                  ))}
                </div>
                <details className="asset-methodology">
                  <summary>{t('Cómo se calculan estos rendimientos')}</summary>
                  <p>{t(data.methodology)}</p>
                </details>
              </>
            )
          )}
          {query.isError && (
            <Button variant="secondary" onClick={() => query.refetch()}>
              {t('Reintentar resumen')}
            </Button>
          )}
        </section>
      </div>
      <section
        className="asset-technical-section"
        id="asset-technical"
        aria-label={t('Conclusión del análisis técnico')}
      >
        <div className="asset-detail-heading">
          <div>
            <span className="asset-overline">{t('ENTENDÉ LA TENDENCIA')}</span>
            <h2>
              <Activity size={24} />
              {t('Análisis técnico')}
            </h2>
            <p>
              {t('Momentum, fuerza y dirección. Tres lecturas para poner el precio en contexto.')}
            </p>
          </div>
        </div>
        <ChartIndicators instrumentId={instrument.id} />
      </section>
      <div className="asset-business-row">
        <section
          className="panel asset-fundamental-panel"
          id="asset-fundamental"
          aria-label={t('Conclusión del análisis fundamental')}
        >
          <div className="asset-detail-heading">
            <div>
              <span className="asset-overline">{t('MIRÁ DETRÁS DEL PRECIO')}</span>
              <h2>
                <Building2 size={24} />
                {t('Análisis fundamental')}
              </h2>
            </div>
            <Button variant="secondary" onClick={onFinancials}>
              {t('Ver estados financieros')}
              <ArrowUpRight size={16} />
            </Button>
          </div>
          {query.isPending ? (
            <Skeleton className="asset-overview-skeleton" />
          ) : data ? (
            <>
              <h3 className="fundamental-verdict">{t(data.fundamental.title)}</h3>
              <p className="fundamental-description">{t(data.fundamental.conclusion)}</p>
              <div className="asset-fundamental-metrics">
                {financialFacts.length
                  ? financialFacts.map((fact) => (
                      <div key={fact.id}>
                        <span>{t(fact.label)}</span>
                        <strong>
                          {format(fact.value, fact.unit !== '%')}
                          <small>{fact.unit}</small>
                        </strong>
                        <time>{dateLabel(fact.asOf, locale)}</time>
                      </div>
                    ))
                  : [
                      'Resultado neto anual',
                      'Flujo operativo anual',
                      'Crecimiento anual de ingresos',
                    ].map((label) => (
                      <div key={label}>
                        <span>{t(label)}</span>
                        <strong>—</strong>
                        <small>{t('Sin datos verificados')}</small>
                      </div>
                    ))}
              </div>
              <details className="asset-methodology">
                <summary>{t('Fuentes y cobertura')}</summary>
                <p>{t(data.fundamental.error ?? data.fundamentals.error ?? '')}</p>
                {data.fundamental.issuerName && (
                  <p>
                    {data.fundamental.issuerName} ·{' '}
                    {data.fundamental.period && dateLabel(data.fundamental.period, locale)}
                  </p>
                )}
                {data.fundamental.warnings.map((warning) => (
                  <p key={warning}>{t(warning)}</p>
                ))}
              </details>
            </>
          ) : (
            <p className="fundamental-description">
              {t('No se pudo recuperar el análisis. El gráfico sigue disponible.')}
            </p>
          )}
        </section>
        <section className="panel asset-risk-panel" aria-label={t('Riesgo del activo')}>
          <div className="asset-detail-heading">
            <div>
              <span className="asset-overline">{t('TENÉ PRESENTE EL RIESGO')}</span>
              <h2>
                <Shield size={23} />
                {t('Riesgo y volatilidad')}
              </h2>
            </div>
          </div>
          <span
            className="risk-label"
            data-level={
              data?.risk.volatility == null
                ? 'unknown'
                : data.risk.volatility >= 40
                  ? 'high'
                  : data.risk.volatility >= 20
                    ? 'medium'
                    : 'low'
            }
          >
            {t(data?.risk.label ?? 'Sin determinar')}
          </span>
          <dl className="asset-risk-values">
            <div>
              <dt>{t('Volatilidad anualizada')}</dt>
              <dd>
                {format(data?.risk.volatility)}
                {data?.risk.volatility != null && '%'}
              </dd>
            </div>
            <div>
              <dt>{t('Caída máxima de la muestra')}</dt>
              <dd className="negative">
                {format(data?.risk.maxDrawdown)}
                {data?.risk.maxDrawdown != null && '%'}
              </dd>
            </div>
          </dl>
          <p>{t(data?.risk.conclusion ?? 'Sin historial suficiente')}</p>
          {data && (
            <details className="asset-methodology">
              <summary>{t('Qué riesgos contempla')}</summary>
              <p>
                {t('Cierres en la muestra')}: {data.risk.observations}
              </p>
              {data.risk.factors.map((factor) => (
                <p key={factor}>{t(factor)}</p>
              ))}
            </details>
          )}
        </section>
      </div>
      <div className="asset-questions-section" id="asset-questions">
        <div className="asset-detail-heading">
          <div>
            <span className="asset-overline">{t('INVESTIGÁ CON APOYO')}</span>
            <h2>
              <MessageSquare size={25} />
              {t('Un lugar para todas tus preguntas')}
            </h2>
            <p>
              {t('Consultá sobre el negocio, los indicadores, los riesgos y las noticias de {0}.', [
                instrument.symbol,
              ])}
            </p>
          </div>
        </div>
        {data ? (
          <AssetChat key={`${instrument.id}:${demo}`} overview={data} />
        ) : (
          <div className="panel asset-chat-pending">
            <p>
              {t(
                query.isPending
                  ? 'Preparando el contexto del activo…'
                  : 'El contexto no está disponible. Actualizá los datos para consultar.',
              )}
            </p>
            <Button variant="secondary" onClick={() => query.refetch()}>
              {t('Actualizar datos')}
            </Button>
          </div>
        )}
      </div>
      <section
        className="asset-company-news"
        id="asset-news"
        aria-label={t('Noticias y contexto del activo')}
      >
        <div className="asset-detail-heading">
          <div>
            <span className="asset-overline">{t('SEGUÍ LO QUE IMPORTA')}</span>
            <h2>
              <Newspaper size={25} />
              {t('Noticias de {0} y su entorno', [instrument.symbol])}
            </h2>
            <p>
              {t(
                'Primero la empresa. También el sector y los movimientos del mercado que conviene seguir.',
              )}
            </p>
          </div>
        </div>
        <News instrumentId={instrument.id} embedded contextual />
      </section>
      {data && (
        <details className="asset-methodology asset-sources">
          <summary>{t('Fuentes y datos del activo')}</summary>
          <dl className="asset-key-facts">
            <div>
              <dt>{t('Mercado')}</dt>
              <dd>{instrument.exchange}</dd>
            </div>
            <div>
              <dt>{t('Moneda')}</dt>
              <dd>{instrument.currency}</dd>
            </div>
            <div>
              <dt>{t('Sector')}</dt>
              <dd>{instrument.sector}</dd>
            </div>
            <div>
              <dt>{t('País')}</dt>
              <dd>{instrument.country}</dd>
            </div>
          </dl>
          {data.sources.map((source) => (
            <p key={source.id}>
              <a href={source.url} target="_blank" rel="noreferrer">
                {source.title}
              </a>{' '}
              · {dateLabel(source.asOf, locale)}
            </p>
          ))}
        </details>
      )}
    </div>
  );
}
