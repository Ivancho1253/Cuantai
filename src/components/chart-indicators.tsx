'use client';
import { useState } from 'react';
import { technicalHorizons, type TechnicalHorizon } from '@/lib/finance/chart-indicators';
import { Activity, BookOpen, RefreshCw, ArrowUpRight } from 'lucide-react';
import { useLocale, useText } from './locale-provider';
import { useChartIndicatorData } from './use-chart-indicators';
import {
  technicalExplanations,
  type IndicatorExplanation,
} from '@/lib/finance/technical-explanations';
import { technicalBias } from '@/lib/finance/technical-bias';

function LearnIndicator({
  reading,
  detailed = false,
}: {
  reading: IndicatorExplanation;
  detailed?: boolean;
}) {
  const t = useText();
  return (
    <>
      {detailed && <p className="indicator-definition">{t(reading.meaning)}</p>}
      <details className="indicator-learn">
        <summary>
          <BookOpen size={15} />
          {t(detailed ? 'Qué más conviene observar' : 'Qué mide y cómo interpretarlo')}
        </summary>
        {!detailed && <p>{t(reading.meaning)}</p>}
        <p>{t(reading.watch)}</p>
        <a href={reading.source} target="_blank" rel="noopener noreferrer">
          {t('Consultar la explicación original')}
          <ArrowUpRight size={13} />
        </a>
      </details>
    </>
  );
}
function Direction({ label }: { label: string }) {
  const t = useText();
  return (
    <span
      className="indicator-direction"
      data-direction={
        label === 'Alcista'
          ? 'bullish'
          : label === 'Bajista'
            ? 'bearish'
            : label === 'Neutral'
              ? 'neutral'
              : 'unavailable'
      }
    >
      {t(label)}
    </span>
  );
}
export function ChartIndicators({
  instrumentId,
  detailed = false,
  horizon: selectedHorizon,
  onHorizonChange,
}: {
  instrumentId: string;
  detailed?: boolean;
  horizon?: TechnicalHorizon;
  onHorizonChange?: (value: TechnicalHorizon) => void;
}) {
  const t = useText();
  const { locale } = useLocale();
  const [localHorizon, setLocalHorizon] = useState<TechnicalHorizon>('short');
  const horizon = selectedHorizon ?? localHorizon;
  const config = technicalHorizons[horizon];
  const query = useChartIndicatorData(instrumentId, horizon);
  const data = query.data;
  const readings = technicalExplanations(data);
  const bias = technicalBias(data);
  const language = locale === 'en' ? 'en-US' : locale === 'pt' ? 'pt-BR' : 'es-AR';
  const format = (value: number | null | undefined, digits = 2) =>
    value == null
      ? '—'
      : new Intl.NumberFormat(language, {
          ...(value !== 0 && Math.abs(value) < 0.01
            ? { maximumSignificantDigits: 4 }
            : { minimumFractionDigits: digits, maximumFractionDigits: digits }),
        }).format(value);
  const date = (value: string) =>
    new Date(value).toLocaleDateString(language, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  const zone =
    data?.rsi.state === 'oversold'
      ? 'Sobreventa'
      : data?.rsi.state === 'overbought'
        ? 'Sobrecompra'
        : data?.rsi.state === 'neutral'
          ? 'Sin extremos'
          : 'No disponible';
  const loading = query.isPending;
  return (
    <section
      className={`chart-indicators${detailed ? ' chart-indicators-detailed' : ''}`}
      aria-label={t('Indicadores técnicos diarios')}
      data-instrument={instrumentId}
    >
      <div className="chart-indicators-heading">
        <div>
          <span className="indicator-heading-icon">
            <Activity size={20} />
          </span>
          <div>
            <h3>{t(detailed ? 'Análisis técnico explicado' : 'Lectura técnica')}</h3>
            <p>
              {t('Velas diarias cerradas')}
              {data && <> · {data.instrument.symbol}</>}
            </p>
          </div>
        </div>
        <button
          className="icon-button"
          aria-label={t('Actualizar lectura técnica')}
          onClick={() => query.refetch()}
          disabled={query.isFetching}
        >
          <RefreshCw size={17} />
        </button>
      </div>
      <div
        className="technical-horizons"
        role="group"
        aria-label={t('Horizonte del análisis técnico')}
      >
        {(Object.keys(technicalHorizons) as TechnicalHorizon[]).map((key) => (
          <button
            key={key}
            aria-pressed={horizon === key}
            onClick={() => {
              setLocalHorizon(key);
              onHorizonChange?.(key);
            }}
          >
            {t(technicalHorizons[key].label)}
          </button>
        ))}
        <small>
          {t('Sesiones diarias')} · RSI {config.rsi} · EMA {config.fast}/{config.slow} ·{' '}
          {t('Niveles')}: {config.lookback}
        </small>
      </div>
      {detailed && (
        <div className="technical-reading-summary">
          <div>
            <span>{t('Lectura conjunta')}</span>
            <strong>{t(bias.label)}</strong>
          </div>
          <p>
            {t(
              'Cada indicador responde una pregunta distinta. Compará el impulso, la tendencia y los niveles: pueden coincidir o mostrar señales diferentes.',
            )}
          </p>
        </div>
      )}
      {(query.isError || data?.error) && (
        <p role="status" className="technical-data-error">
          {t('No se pudo obtener el historial de este activo. Podés volver a consultar.')}
        </p>
      )}
      <div className="indicator-cards" aria-busy={loading}>
        <article
          className="indicator-card"
          data-indicator="rsi"
          data-direction={readings.rsi.label}
        >
          <div className="indicator-card-title">
            <h4>
              RSI <span>{config.rsi}</span>
            </h4>
            <Direction label={readings.rsi.label} />
          </div>
          <div className="indicator-main-value">
            <strong>{loading ? '…' : format(data?.rsi.value, 1)}</strong>
            <span className="rsi-zone" data-zone={data?.rsi.state}>
              {t(zone)}
            </span>
          </div>
          <p className="indicator-current-reading">{t(readings.rsi.summary)}</p>
          <LearnIndicator reading={readings.rsi} detailed={detailed} />
        </article>
        <article
          className="indicator-card"
          data-indicator="macd"
          data-direction={readings.macd.label}
        >
          <div className="indicator-card-title">
            <h4>
              MACD <span>{config.macd.join(' · ')}</span>
            </h4>
            <Direction label={readings.macd.label} />
          </div>
          <div className="indicator-main-value">
            <strong>{loading ? '…' : format(data?.macd.histogram, 3)}</strong>
            <span>{t('Histograma')}</span>
          </div>
          <dl className="indicator-support-values">
            <div>
              <dt>{t('Línea')}</dt>
              <dd>{format(data?.macd.line, 3)}</dd>
            </div>
            <div>
              <dt>{t('Señal')}</dt>
              <dd>{format(data?.macd.signal, 3)}</dd>
            </div>
          </dl>
          <p className="indicator-current-reading">{t(readings.macd.summary)}</p>
          <LearnIndicator reading={readings.macd} detailed={detailed} />
        </article>
        <article
          className="indicator-card"
          data-indicator="trend"
          data-direction={readings.trend.label}
        >
          <div className="indicator-card-title">
            <h4>
              {t('Tendencia')}{' '}
              <span>
                EMA {config.fast} / {config.slow}
              </span>
            </h4>
            <Direction label={readings.trend.label} />
          </div>
          <div className="indicator-main-value trend-reading">
            <strong>{t(loading ? 'Calculando lectura…' : readings.trend.label)}</strong>
          </div>
          <dl className="indicator-support-values indicator-ema-values">
            {[
              ['EMA ' + config.fast, data?.trend.fast],
              ['EMA ' + config.slow, data?.trend.slow],
              ...(config.slow === 200 ? [] : [['EMA 200', data?.trend.ema200]]),
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{format(value as number | null | undefined)}</dd>
              </div>
            ))}
          </dl>
          <div
            className="ema-200-reading"
            data-direction={
              data?.close != null && data.trend.ema200 != null
                ? data.close >= data.trend.ema200
                  ? 'bullish'
                  : 'bearish'
                : 'unavailable'
            }
          >
            <span>{t('Tendencia de fondo')} · EMA 200</span>
            <strong>
              {data?.close != null && data.trend.ema200 != null
                ? t(data.close >= data.trend.ema200 ? 'Alcista' : 'Bajista')
                : t('Sin historial suficiente')}
            </strong>
            <p>
              {data?.close != null && data.trend.ema200 != null
                ? t(
                    data.close >= data.trend.ema200
                      ? 'El cierre está por encima de la EMA 200: estructura de largo plazo alcista.'
                      : 'El cierre está por debajo de la EMA 200: estructura de largo plazo bajista.',
                  )
                : t('Se necesitan 200 cierres diarios para esta media.')}
            </p>
          </div>
          <p className="indicator-current-reading">{t(readings.trend.summary)}</p>
          <LearnIndicator reading={readings.trend} detailed={detailed} />
        </article>
      </div>
      {detailed && (
        <section className="technical-price-levels" aria-label={t('Soportes y resistencias')}>
          <div className="technical-price-levels-heading">
            <div>
              <h4>{t('Soportes y resistencias')}</h4>
              <p>
                {t('Ventana de referencia')}: {config.lookback}{' '}
                {t('sesiones anteriores al último cierre')}
              </p>
            </div>
            <Direction label={readings.levels.label} />
          </div>
          <div className="technical-level-values">
            <div data-level="support">
              <span>{t('Soporte de referencia')}</span>
              <strong>
                {format(data?.levels?.support)}
                <small>{data?.instrument.currency}</small>
              </strong>
              <p>
                {data?.levels?.supportDistancePercent != null
                  ? t(
                      data.levels.supportDistancePercent >= 0
                        ? 'El cierre está {0}% por encima.'
                        : 'El cierre está {0}% por debajo.',
                      [format(Math.abs(data.levels.supportDistancePercent))],
                    )
                  : t('Sin historial suficiente')}
              </p>
            </div>
            <div className="technical-last-close">
              <span>{t('Último cierre')}</span>
              <strong>
                {format(data?.close)}
                <small>{data?.instrument.currency}</small>
              </strong>
            </div>
            <div data-level="resistance">
              <span>{t('Resistencia de referencia')}</span>
              <strong>
                {format(data?.levels?.resistance)}
                <small>{data?.instrument.currency}</small>
              </strong>
              <p>
                {data?.levels?.resistanceDistancePercent != null
                  ? t(
                      data.levels.resistanceDistancePercent >= 0
                        ? 'El cierre está {0}% por debajo.'
                        : 'El cierre está {0}% por encima.',
                      [format(Math.abs(data.levels.resistanceDistancePercent))],
                    )
                  : t('Sin historial suficiente')}
              </p>
            </div>
          </div>
          <div className="technical-range" aria-hidden="true">
            {data?.levels?.position != null && <i style={{ left: `${data.levels.position}%` }} />}
          </div>
          <p className="technical-level-interpretation">{t(readings.levels.summary)}</p>
          <LearnIndicator reading={readings.levels} detailed />
          {data?.trend.ema200 != null && (
            <p className="long-term-trend">
              {t('Referencia de largo plazo')}: EMA 200{' '}
              <strong>
                {format(data.trend.ema200)} {data.instrument.currency}
              </strong>
              .{' '}
              {t(
                data.close != null && data.close >= data.trend.ema200
                  ? 'El cierre está por encima de esta media.'
                  : 'El cierre está por debajo de esta media.',
              )}
            </p>
          )}
        </section>
      )}
      <div className="indicator-provenance">
        <span>
          {loading ? (
            t('Consultando historial…')
          ) : data ? (
            <>
              {data.provenance.status === 'demo' ? t('Datos demo') : data.provenance.source}
              {data.asOf && (
                <>
                  {' '}
                  · {t('Último cierre')}: {date(data.asOf)}
                </>
              )}
            </>
          ) : (
            t('No disponible')
          )}
        </span>
        <span>{t('Lectura diaria independiente del período del gráfico.')}</span>
      </div>
      <details className="technical-reading-method">
        <summary>{t('Criterios de esta lectura')}</summary>
        <p>
          {t(
            'El impulso del RSI se resume como alcista sobre 55, bajista bajo 45 y neutral entre ambos. Las zonas de sobrecompra y sobreventa siguen siendo 70 y 30.',
          )}
        </p>
        <p>
          {t(
            'Para la tendencia, las EMA del horizonte se consideran próximas cuando se separan hasta 0,5%. Cerca de un soporte o resistencia significa a no más de 1% del último cierre. Son criterios descriptivos de Cuantai.',
          )}
        </p>
        <p>
          {t(
            'Los cálculos usan velas diarias cerradas del proveedor indicado. El gráfico de TradingView tiene su propio feed y puede usar otro período o ajuste de precios.',
          )}
        </p>
      </details>
    </section>
  );
}
