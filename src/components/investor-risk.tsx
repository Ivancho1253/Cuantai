'use client';
import {
  ShieldCheck,
  Activity,
  TrendingDown,
  BarChart3,
  ArrowDownToLine,
  Scale,
} from 'lucide-react';
import { useLocale, useText } from './locale-provider';
import { useFundamentalResearch } from './fundamental-research';
import type { AssetOverview } from '@/lib/finance/asset-overview';
import type { Instrument } from '@/lib/market/types';
export function InvestorRisk({
  instrument,
  overview,
}: {
  instrument: Instrument;
  overview?: AssetOverview;
}) {
  const t = useText(),
    { locale } = useLocale(),
    fundamentals = useFundamentalResearch(instrument.id);
  const language = locale === 'en' ? 'en-US' : locale === 'pt' ? 'pt-BR' : 'es-AR';
  const f = (n: number | null | undefined, compact = false) =>
    n == null
      ? '—'
      : new Intl.NumberFormat(language, {
          maximumFractionDigits: 2,
          ...(compact ? { notation: 'compact' as const } : {}),
        }).format(n);
  const risk = overview?.risk,
    financial = fundamentals.data?.periods[0];
  const debt = financial?.values.TotalDebt,
    cash = financial?.values.CashCashEquivalentsAndShortTermInvestments;
  const debtCash = debt != null && cash != null && cash > 0 ? debt / cash : null;
  const cards = [
    {
      id: 'volatility',
      Icon: Activity,
      label: 'Oscilación del precio',
      value: risk?.volatility,
      unit: '% anual',
      tone:
        risk?.volatility == null
          ? 'neutral'
          : risk.volatility >= 40
            ? 'negative'
            : risk.volatility >= 20
              ? 'warning'
              : 'positive',
      text: 'Más volatilidad significa movimientos más amplios. Describe cómo se movió el precio; no es el rendimiento.',
    },
    {
      id: 'drawdown',
      Icon: TrendingDown,
      label: 'Peor caída desde un máximo',
      value: risk?.maxDrawdown,
      unit: '%',
      tone: 'negative',
      text: 'Mayor retroceso entre un máximo de cierre y un cierre posterior dentro de la muestra.',
    },
    {
      id: 'daily',
      Icon: BarChart3,
      label: 'Variación diaria típica',
      value: risk?.typicalDailyMove,
      unit: '%',
      tone: 'blue',
      text: 'Dispersión histórica de los cambios diarios. Ayuda a dimensionar las oscilaciones de una sesión.',
    },
    {
      id: 'peak',
      Icon: ArrowDownToLine,
      label: 'Distancia al máximo de cierre',
      value: risk?.distanceFromPeak,
      unit: '%',
      tone: 'purple',
      text: 'Ubica el último cierre respecto del mayor cierre de la muestra. Cero significa que está en ese máximo.',
    },
    {
      id: 'turnover',
      Icon: BarChart3,
      label: 'Negociado por día',
      value: risk?.averageTurnover,
      unit: instrument.currency,
      tone: 'blue',
      text: 'Promedio de 20 sesiones: precio de cierre × volumen. Sirve para comparar el tamaño de una posición con la actividad negociada.',
    },
    ...(debtCash === null
      ? []
      : [
          {
            id: 'debtCash',
            Icon: Scale,
            label: 'Deuda / caja e inversiones',
            value: debtCash,
            unit: '×',
            tone: debtCash > 1 ? 'warning' : 'positive',
            text: 'Compara deuda financiera con efectivo e inversiones de corto plazo. Por encima de 1, la deuda supera esa caja; no mide por sí sola capacidad de pago.',
          },
        ]),
  ];
  return (
    <section className="panel investor-risk-panel" aria-label={t('Riesgo del activo')}>
      <div className="asset-detail-heading">
        <div>
          <span className="asset-overline">{t('ANTES DE INVERTIR')}</span>
          <h2>
            <ShieldCheck size={23} />
            {t('Riesgo, en contexto')}
          </h2>
        </div>
      </div>
      <p className="investor-risk-intro">{t('Lo que conviene mirar además de la rentabilidad.')}</p>
      <div className="investor-risk-grid">
        {cards.map(({ id, Icon, label, value, unit, tone, text }) => (
          <article key={id} data-risk={id} data-tone={tone}>
            <div className="investor-risk-label">
              <Icon size={17} />
              <span>{t(label)}</span>
            </div>
            <strong>
              {f(value, id === 'turnover')} <small>{t(unit)}</small>
            </strong>
            <p>{value == null ? t('Sin datos suficientes para esta medición.') : t(text)}</p>
          </article>
        ))}
      </div>
      <div className="investor-risk-notes">
        <strong>{t('También importa')}</strong>
        <p>
          {t(
            instrument.type === 'cedear'
              ? 'El CEDEAR agrega tipo de cambio, ratio del certificado y liquidez local al riesgo del emisor.'
              : instrument.type === 'crypto'
                ? 'Además del precio: custodia, seguridad de la red, emisión y liquidez. El riesgo de la moneda de cotización también cuenta.'
                : instrument.type === 'etf'
                  ? 'Revisá la composición, concentración, comisión y método de réplica del fondo.'
                  : instrument.country === 'AR'
                    ? 'El riesgo local incluye tipo de cambio, inflación, regulación y liquidez del mercado.'
                    : 'Resultados, deuda, competencia y próximos anuncios pueden cambiar la lectura del negocio.',
          )}
        </p>
      </div>
      <details className="asset-methodology">
        <summary>{t('Período y fuentes')}</summary>
        <p>
          {risk?.from} → {risk?.to} · {risk?.observations ?? 0} {t('cierres en la muestra')}.{' '}
          {overview?.provenance.source}
        </p>
        <p>
          {t(
            'Las mediciones de precio usan cierres diarios; no incluyen spreads ni profundidad del libro de órdenes.',
          )}
        </p>
        {financial && (
          <p>
            {t('Deuda y caja')}: {financial.date} · {financial.currency} ·{' '}
            {fundamentals.data?.issuer}
          </p>
        )}
      </details>
    </section>
  );
}
