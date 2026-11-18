'use client';
import type { TechnicalHorizon } from '@/lib/finance/chart-indicators';
import { useId } from 'react';
import { Gauge, RefreshCw } from 'lucide-react';
import { useChartIndicatorData } from './use-chart-indicators';
import { useText, useLocale } from './locale-provider';
import { technicalBias } from '@/lib/finance/technical-bias';

export function TechnicalGauge({
  instrumentId,
  horizon = 'short',
}: {
  instrumentId: string;
  horizon?: TechnicalHorizon;
}) {
  const query = useChartIndicatorData(instrumentId, horizon);
  const t = useText();
  const { locale } = useLocale();
  const gradient = useId();
  const data = query.data;
  const bias = technicalBias(data);
  return (
    <section
      className="panel technical-gauge"
      aria-label={t('Sesgo técnico del activo')}
      data-score={bias.score ?? ''}
    >
      <div className="gauge-heading">
        <Gauge size={20} />
        <h2>{t('Pulso del activo')}</h2>
        <span>
          {t(
            horizon === 'short'
              ? 'Corto plazo'
              : horizon === 'medium'
                ? 'Mediano plazo'
                : 'Largo plazo',
          )}
        </span>
        <button
          className="icon-button"
          aria-label={t('Actualizar indicadores')}
          disabled={query.isFetching}
          onClick={() => query.refetch()}
        >
          <RefreshCw size={16} />
        </button>
      </div>
      <div className="gauge-dial">
        <svg viewBox="0 0 240 140" role="img" aria-label={t('Sesgo técnico: {0}', [t(bias.label)])}>
          <defs>
            <linearGradient id={gradient} x1="0%" x2="100%">
              <stop offset="0%" stopColor="#ce7587" />
              <stop offset="28%" stopColor="#c89384" />
              <stop offset="50%" stopColor="#c0b28b" />
              <stop offset="75%" stopColor="#83b69b" />
              <stop offset="100%" stopColor="#57b39d" />
            </linearGradient>
          </defs>
          <path
            d="M32 110 A88 88 0 0 1 208 110"
            fill="none"
            stroke={`url(#${gradient})`}
            strokeWidth="17"
            strokeLinecap="round"
            opacity={bias.score === null ? 0.25 : 1}
          />
          {[0, 25, 50, 75, 100].map((value) => (
            <path
              key={value}
              d="M120 7 v8"
              transform={`rotate(${value * 1.8 - 90} 120 110)`}
              stroke="currentColor"
              opacity=".35"
              strokeWidth="2"
            />
          ))}
          {bias.score !== null && (
            <g
              className="gauge-needle"
              style={{ transform: `rotate(${bias.score * 1.8 - 90}deg)` }}
            >
              <path d="M116 110 L120 43 L124 110 Z" fill="currentColor" />
              <circle cx="120" cy="110" r="8" fill="currentColor" />
              <circle cx="120" cy="110" r="3" fill="var(--surface)" />
            </g>
          )}
        </svg>
        <div className="gauge-extremes">
          <span>{t('Bajista')}</span>
          <span>{t('Alcista')}</span>
        </div>
      </div>
      <strong
        className="gauge-verdict"
        data-direction={
          bias.score === null
            ? 'unavailable'
            : bias.score > 60
              ? 'bullish'
              : bias.score < 40
                ? 'bearish'
                : 'neutral'
        }
      >
        {t(query.isPending ? 'Calculando lectura…' : bias.label)}
      </strong>
      <p>{t('RSI, MACD y medias móviles. Una lectura conjunta de la tendencia diaria.')}</p>
      {data?.asOf && (
        <small>
          {t('Último cierre')}:{' '}
          {new Date(data.asOf).toLocaleDateString(
            locale === 'en' ? 'en-US' : locale === 'pt' ? 'pt-BR' : 'es-AR',
            { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' },
          )}
        </small>
      )}
      <details>
        <summary>{t('Cómo se interpreta')}</summary>
        <p>
          {t(
            'Tres lecturas con el mismo peso: RSI mayor a 55 o menor a 45, MACD respecto de su señal y EMA corta respecto de la EMA larga del horizonte elegido. El centro indica equilibrio; los extremos, coincidencia de dirección. No representa una probabilidad de ganancia.',
          )}
        </p>
      </details>
    </section>
  );
}
