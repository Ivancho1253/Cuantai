'use client';

import { useQuery } from '@tanstack/react-query';
import { Activity, ArrowDownRight, ArrowUpRight, Minus, RefreshCw } from 'lucide-react';
import { useLocale, useText } from './locale-provider';
import { api } from '@/lib/utils';
import type { ChartIndicatorData } from '@/lib/finance/chart-indicators';

export function useChartIndicatorData(instrumentId: string) {
  return useQuery({
    // TradingView displays market data even in the public demo, so these readings do too.
    queryKey: ['chart-indicators', instrumentId],
    queryFn: () =>
      api<ChartIndicatorData>(`chart-indicators?id=${encodeURIComponent(instrumentId)}`),
    staleTime: 60000,
    refetchInterval: 60000,
  });
}

export function ChartIndicators({ instrumentId }: { instrumentId: string }) {
  const t = useText();
  const { locale } = useLocale();
  const language = locale === 'en' ? 'en-US' : locale === 'pt' ? 'pt-BR' : 'es-AR';
  const query = useChartIndicatorData(instrumentId);
  const data = query.data;
  const format = (value: number | null | undefined, digits = 2) =>
    value == null
      ? '—'
      : new Intl.NumberFormat(language, {
          minimumFractionDigits: digits,
          maximumFractionDigits: digits,
        }).format(value);
  const status = (state?: string) =>
    t(
      (
        {
          overbought: 'Sobrecompra',
          oversold: 'Sobreventa',
          neutral: 'Neutral',
          bullish: 'Alcista',
          bearish: 'Bajista',
        } as Record<string, string>
      )[state ?? ''] ?? 'No disponible',
    );
  const trendIcon =
    data?.trend.state === 'bullish' ? (
      <ArrowUpRight size={23} />
    ) : data?.trend.state === 'bearish' ? (
      <ArrowDownRight size={23} />
    ) : (
      <Minus size={23} />
    );
  const maxHistogram = Math.max(...(data?.macd.recent ?? []).map(Math.abs), 1e-12);
  return (
    <section
      className="chart-indicators"
      aria-label={t('Indicadores técnicos diarios')}
      data-instrument={instrumentId}
    >
      <div className="chart-indicators-heading">
        <div>
          <span className="indicator-heading-icon">
            <Activity size={19} />
          </span>
          <div>
            <h3>{t('Lectura técnica')}</h3>
            <p>
              {t('Velas diarias cerradas')}
              {data && <> · {data.instrument.symbol}</>}
            </p>
          </div>
        </div>
        <button
          className="icon-button"
          aria-label={t('Actualizar indicadores')}
          disabled={query.isFetching}
          onClick={() => query.refetch()}
        >
          <RefreshCw size={17} />
        </button>
      </div>
      <div className="indicator-cards" aria-busy={query.isPending}>
        <article className="indicator-card" data-indicator="rsi">
          <div className="indicator-card-title">
            <h4>
              RSI <span>14</span>
            </h4>
            <span className="indicator-index">01</span>
          </div>
          <div className="indicator-reading">
            <strong>{query.isPending ? '…' : format(data?.rsi.value, 1)}</strong>
            <span className="indicator-status" data-state={data?.rsi.state}>
              {status(data?.rsi.state)}
            </span>
          </div>
          <div className="rsi-gauge" aria-hidden="true">
            <span />
            {data?.rsi.value != null && (
              <i style={{ left: `${Math.max(0, Math.min(100, data.rsi.value))}%` }} />
            )}
          </div>
          <div className="rsi-scale" aria-hidden="true">
            <span>0</span>
            <span>30</span>
            <span>70</span>
            <span>100</span>
          </div>
          <p>
            {t(
              'Hasta 30: sobreventa. Desde 70: sobrecompra. Entre ambos, sin extremos de momentum.',
            )}
          </p>
        </article>
        <article className="indicator-card" data-indicator="macd">
          <div className="indicator-card-title">
            <h4>
              MACD <span>12 · 26 · 9</span>
            </h4>
            <span className="indicator-index">02</span>
          </div>
          <div className="indicator-reading">
            <strong>{query.isPending ? '…' : format(data?.macd.histogram, 3)}</strong>
            <span className="indicator-status" data-state={data?.macd.state}>
              {status(data?.macd.state)}
            </span>
          </div>
          <div className="macd-history" aria-hidden="true">
            {data?.macd.recent.map((value, index) => (
              <span
                key={index}
                className={value >= 0 ? 'above' : 'below'}
                style={{ height: `${Math.max(2, (Math.abs(value) / maxHistogram) * 50)}%` }}
              />
            ))}
          </div>
          <div className="indicator-details">
            <span>
              {t('Línea')} <b>{format(data?.macd.line, 3)}</b>
            </span>
            <span>
              {t('Señal')} <b>{format(data?.macd.signal, 3)}</b>
            </span>
          </div>
          <p>
            {t(
              'Histograma positivo: MACD sobre su señal. Negativo: impulso por debajo de la señal.',
            )}
          </p>
        </article>
        <article className="indicator-card" data-indicator="trend">
          <div className="indicator-card-title">
            <h4>
              {t('Tendencia')} <span>EMA 20 / 50</span>
            </h4>
            <span className="indicator-index">03</span>
          </div>
          <div className="indicator-reading trend-reading">
            <strong>
              {trendIcon}
              {status(data?.trend.state)}
            </strong>
          </div>
          <div className="ema-values">
            <div>
              <span>EMA 20</span>
              <strong>{format(data?.trend.ema20)}</strong>
            </div>
            <div>
              <span>EMA 50</span>
              <strong>{format(data?.trend.ema50)}</strong>
            </div>
          </div>
          <p>
            {t(
              'La media de 20 sesiones sobre la de 50 indica tendencia alcista; por debajo, bajista.',
            )}
          </p>
        </article>
      </div>
      <div className="indicator-provenance">
        {query.isError || data?.error ? (
          <span role="status">
            {t('No se pudo obtener el historial de este activo. Podés volver a consultar.')}
          </span>
        ) : data ? (
          <span>
            {data.provenance.status === 'demo' ? t('Datos demo') : data.provenance.source}
            {data.asOf && (
              <>
                {' '}
                · {t('Último cierre')}:{' '}
                {new Date(data.asOf).toLocaleDateString(language, {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  timeZone: 'UTC',
                })}
              </>
            )}
            {!data.sampleSize && <> · {t('Sin historial suficiente')}</>}
          </span>
        ) : (
          <span>{t('Consultando historial…')}</span>
        )}
        <span>{t('Lectura diaria independiente del período del gráfico.')}</span>
      </div>
    </section>
  );
}
