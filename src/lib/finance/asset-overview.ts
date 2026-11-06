import Decimal from 'decimal.js';
import { technicalMetrics } from './indicators';
import type { FinancialStatementsResult } from './statements';
import type { Fundamental, MarketSnapshot, Provenance } from '../market/types';
import type { ResearchSource } from '../ai/report';

const DAY = 86400000;
export type FundamentalsResult = {
  metrics: Fundamental[];
  provenance?: Provenance;
  error?: string;
};
export type Performance = {
  id: 'day' | 'week' | 'month' | 'year';
  label: string;
  value: number | null;
  from: string | null;
  to: string | null;
  reason?: string;
};
export type EvidenceFact = { id: string; label: string; value: string; unit: string; asOf: string };
// Calendar offsets clamp month ends (March 31 → February 28), rather than overflowing.
function offsetDate(time: number, months: number) {
  const date = new Date(time);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - months);
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, last));
  return date.getTime();
}
const iso = (seconds: number) => new Date(seconds * 1000).toISOString().slice(0, 10);
export function buildAssetOverview(
  snapshot: MarketSnapshot,
  fundamentals: FundamentalsResult,
  financials: FinancialStatementsResult,
  now = new Date(),
) {
  const demo = snapshot.provenance.status === 'demo';
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 1000;
  // Conservatively exclude today's bar even when a provider reports an EOD quote.
  // Quote and split-adjusted history are never mixed in return calculations.
  const trusted =
    snapshot.timeframe === '1D' &&
    snapshot.provenance.status !== 'unavailable' &&
    Boolean(snapshot.provenance.source && snapshot.provenance.url && snapshot.provenance.asOf);
  const candles = [...(trusted ? snapshot.candles : [])]
    .filter((c) => c.time < today && Number.isFinite(c.close) && c.close > 0)
    .sort((a, b) => a.time - b.time)
    .filter((c, index, all) => !index || c.time !== all[index - 1].time);
  const last = candles.at(-1);
  const end = last ? iso(last.time) : null;
  const stale =
    !demo &&
    (!last ||
      now.getTime() - last.time * 1000 > (snapshot.instrument.type === 'crypto' ? 2 : 4) * DAY);
  const performance: Performance[] = (['day', 'week', 'month', 'year'] as const).map((id) => {
    const label = { day: 'Diario', week: 'Semanal', month: 'Mensual', year: 'Anual' }[id];
    if (!last)
      return {
        id,
        label,
        value: null,
        from: null,
        to: null,
        reason: snapshot.error ?? 'Sin cierres diarios disponibles.',
      };
    const target =
      id === 'day'
        ? last.time * 1000 - DAY
        : id === 'week'
          ? last.time * 1000 - 7 * DAY
          : offsetDate(last.time * 1000, id === 'month' ? 1 : 12);
    const base = candles.findLast((c) => c.time * 1000 <= target);
    if (!base || target - base.time * 1000 > 7 * DAY)
      return {
        id,
        label,
        value: null,
        from: null,
        to: end,
        reason: 'Histórico insuficiente para cubrir el período completo.',
      };
    return {
      id,
      label,
      value: new Decimal(last.close).div(base.close).minus(1).mul(100).toNumber(),
      from: iso(base.time),
      to: end,
    };
  });
  const metrics = candles.length >= 50 ? technicalMetrics(candles) : null;
  const technical = {
    title: !metrics
      ? 'Sin lectura suficiente'
      : metrics.trend === 'uptrend'
        ? 'Sesgo alcista'
        : metrics.trend === 'downtrend'
          ? 'Sesgo bajista'
          : 'Sin dirección definida',
    conclusion: !metrics
      ? 'Se necesitan al menos cincuenta cierres diarios para comparar las medias y el momentum.'
      : `La media exponencial corta está ${metrics.trend === 'uptrend' ? 'por encima de' : metrics.trend === 'downtrend' ? 'por debajo de' : 'al mismo nivel que'} la media lenta. ${metrics.rsi !== null && metrics.rsi >= 70 ? 'El RSI muestra momentum elevado; conviene observar posibles retrocesos.' : metrics.rsi !== null && metrics.rsi <= 30 ? 'El RSI muestra momentum débil; no confirma por sí solo una recuperación.' : 'El RSI no señala un extremo de momentum.'} Es una lectura de cierres históricos, sin señal automática de compra o venta.`,
    metrics,
  };
  const cryptoAsset = snapshot.instrument.type === 'crypto';
  const window = candles.slice(-(cryptoAsset ? 366 : 253));
  const logs = window.slice(1).map((c, i) => Math.log(c.close / window[i].close));
  // A sparse series cannot be annualized as if every observed return were daily.
  const regular = window.every(
    (c, i) => !i || c.time - window[i - 1].time <= (cryptoAsset ? 1 : 7) * 86400,
  );
  const mean = logs.reduce((sum, v) => sum + v, 0) / (logs.length || 1);
  const volatility =
    logs.length >= 60 && regular
      ? Math.sqrt(logs.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (logs.length - 1)) *
        Math.sqrt(cryptoAsset ? 365 : 252) *
        100
      : null;
  let peak = 0,
    drawdown = 0;
  for (const candle of window) {
    peak = Math.max(peak, candle.close);
    drawdown = Math.min(drawdown, (candle.close / peak - 1) * 100);
  }
  const risk = {
    label:
      volatility === null
        ? 'Sin determinar'
        : volatility >= 40
          ? 'Volatilidad alta'
          : volatility >= 20
            ? 'Volatilidad intermedia'
            : 'Volatilidad baja',
    volatility,
    maxDrawdown: logs.length >= 60 && regular ? drawdown : null,
    observations: window.length,
    from: window[0] ? iso(window[0].time) : null,
    to: end,
    conclusion:
      volatility === null
        ? 'Falta una muestra continua de al menos sesenta variaciones diarias. La ausencia de datos no implica riesgo bajo.'
        : 'La volatilidad mide la dispersión histórica y la caída máxima mide la pérdida desde un pico de cierre. No evalúan por sí solas solvencia, liquidez ni pérdidas futuras.',
    factors: [
      ...(cryptoAsset
        ? ['Mercado continuo, saltos de precio y riesgo de la stablecoin de cotización.']
        : []),
      ...(snapshot.instrument.type === 'cedear'
        ? ['Riesgo del emisor subyacente, tipo de cambio, ratio y liquidez de esta especie BYMA.']
        : []),
      ...(snapshot.instrument.type === 'etf'
        ? [
            'Concentración, composición, comisiones y tracking del fondo requieren documentación adicional.',
          ]
        : []),
      'No se incorporaron spreads, profundidad de mercado ni tolerancia personal al riesgo.',
    ],
  };
  const data = financials.data;
  const period = data?.periods[0];
  const prior = data?.periods[1];
  const cell = (id: string, periodId?: string) =>
    periodId ? (data?.rows.find((r) => r.id === id)?.values[periodId]?.value ?? null) : null;
  const income = cell('netIncome', period?.id),
    cash = cell('operatingCashFlow', period?.id);
  const revenue = cell('revenue', period?.id),
    oldRevenue = cell('revenue', prior?.id);
  const duration = (p: NonNullable<typeof period>) =>
    (Date.parse(p.end) - Date.parse(p.start)) / DAY;
  const comparable =
    period &&
    prior &&
    Math.abs(duration(period) - duration(prior)) <= 8 &&
    Date.parse(period.end) - Date.parse(prior.end) >= 330 * DAY &&
    Date.parse(period.end) - Date.parse(prior.end) <= 400 * DAY;
  const growth =
    comparable && revenue !== null && oldRevenue !== null && new Decimal(oldRevenue).gt(0)
      ? new Decimal(revenue).div(oldRevenue).minus(1).mul(100).toNumber()
      : null;
  const corporate = ['stock', 'cedear'].includes(snapshot.instrument.type);
  const fundamental = {
    title: !corporate
      ? 'Requiere otro enfoque'
      : period && (income !== null || cash !== null)
        ? 'Lectura del último ejercicio'
        : 'No concluyente',
    conclusion: !corporate
      ? cryptoAsset
        ? 'Un criptoactivo no tiene beneficios empresariales ni P/E. Para evaluarlo faltan métricas verificadas de red, emisión, uso y custodia.'
        : 'Este instrumento requiere analizar su composición, metodología y costos. Los estados de una empresa aislada no describen al fondo o índice.'
      : period && (income !== null || cash !== null)
        ? `En el ejercicio cerrado el ${period.end}, ${income === null ? 'el resultado neto no está disponible' : new Decimal(income).gt(0) ? 'el resultado neto fue positivo' : new Decimal(income).lt(0) ? 'hubo pérdidas netas' : 'el resultado neto fue nulo'} y ${cash === null ? 'no hay flujo operativo validado' : new Decimal(cash).gt(0) ? 'el flujo operativo fue positivo' : new Decimal(cash).lt(0) ? 'el flujo operativo fue negativo' : 'el flujo operativo fue nulo'}. ${growth === null ? 'No hay una comparación de ingresos anual homogénea disponible.' : growth > 0 ? 'Los ingresos crecieron frente al ejercicio anterior comparable.' : growth < 0 ? 'Los ingresos cayeron frente al ejercicio anterior comparable.' : 'Los ingresos se mantuvieron frente al ejercicio anterior comparable.'} Esta lectura no determina si el precio actual es atractivo.`
        : 'No hay estados financieros con períodos y resultados suficientes para concluir sobre rentabilidad, caja o valuación. Las métricas aisladas no bastan para declarar al activo barato o caro.',
    period: period?.end ?? null,
    revenueGrowth: growth,
    error: financials.error,
    warnings: data?.warnings ?? [],
    issuerName: data?.entityName ?? null,
  };
  const sources: ResearchSource[] = [
    ...(snapshot.quote
      ? [
          {
            id: 'quote',
            title: snapshot.quote.source,
            url: snapshot.quote.url,
            asOf: snapshot.quote.asOf,
            retrievedAt: snapshot.quote.retrievedAt,
          },
        ]
      : []),
    ...(last
      ? [
          {
            id: 'market',
            title: snapshot.provenance.source,
            url: snapshot.provenance.url,
            asOf: end!,
            retrievedAt: snapshot.provenance.retrievedAt,
          },
        ]
      : []),
    ...(fundamentals.provenance
      ? [
          {
            id: 'fundamentals',
            title: fundamentals.provenance.source,
            url: fundamentals.provenance.url,
            asOf: fundamentals.provenance.asOf,
            retrievedAt: fundamentals.provenance.retrievedAt,
          },
        ]
      : []),
    ...(period
      ? [
          {
            id: 'financials',
            title: `SEC ${period.form} · ${data!.entityName}`,
            url: period.url,
            asOf: period.end,
            retrievedAt: data!.retrievedAt,
          },
        ]
      : []),
    ...(growth !== null && prior
      ? [
          {
            id: 'financials-prior',
            title: `SEC ${prior.form} · ejercicio anterior`,
            url: prior.url,
            asOf: prior.end,
            retrievedAt: data!.retrievedAt,
          },
        ]
      : []),
  ];
  const facts: EvidenceFact[] = [
    ...(snapshot.quote
      ? [
          {
            id: 'quote-price',
            label: 'Cotización del proveedor',
            value: snapshot.quote.price,
            unit: snapshot.instrument.currency,
            asOf: snapshot.quote.asOf,
          },
        ]
      : []),
    ...(fundamentals.provenance
      ? fundamentals.metrics.flatMap((metric, index) =>
          metric.value !== null && Number.isFinite(Number(metric.value))
            ? [
                {
                  id: `fundamental-${index}`,
                  label: metric.label,
                  value: metric.value,
                  unit: metric.unit ?? '',
                  asOf: fundamentals.provenance!.asOf,
                },
              ]
            : [],
        )
      : []),
    ...(income !== null
      ? [
          {
            id: 'net-income',
            label: 'Resultado neto anual',
            value: income,
            unit: 'USD',
            asOf: period!.end,
          },
        ]
      : []),
    ...(cash !== null
      ? [
          {
            id: 'operating-cash-flow',
            label: 'Flujo operativo anual',
            value: cash,
            unit: 'USD',
            asOf: period!.end,
          },
        ]
      : []),
    ...performance
      .filter((p) => p.value !== null)
      .map((p) => ({
        id: `return-${p.id}`,
        label: `Rendimiento ${p.label.toLowerCase()}`,
        value: p.value!.toFixed(2),
        unit: '%',
        asOf: p.to!,
      })),
    ...(metrics
      ? [
          { id: 'rsi', label: 'RSI diario', value: metrics.rsi!.toFixed(2), unit: '', asOf: end! },
          {
            id: 'ema20',
            label: 'EMA 20 diaria',
            value: metrics.ema20!.toFixed(2),
            unit: snapshot.instrument.currency,
            asOf: end!,
          },
          {
            id: 'ema50',
            label: 'EMA 50 diaria',
            value: metrics.ema50!.toFixed(2),
            unit: snapshot.instrument.currency,
            asOf: end!,
          },
        ]
      : []),
    ...(volatility !== null
      ? [
          {
            id: 'volatility',
            label: 'Volatilidad anualizada',
            value: volatility.toFixed(2),
            unit: '%',
            asOf: end!,
          },
          {
            id: 'drawdown',
            label: 'Caída máxima de la muestra',
            value: drawdown.toFixed(2),
            unit: '%',
            asOf: end!,
          },
        ]
      : []),
    ...(growth !== null
      ? [
          {
            id: 'revenue-growth',
            label: 'Crecimiento anual de ingresos',
            value: growth.toFixed(2),
            unit: '%',
            asOf: period!.end,
          },
        ]
      : []),
  ];
  return {
    instrument: snapshot.instrument,
    demo,
    stale,
    quote: snapshot.quote,
    dataAsOf: end,
    provenance: snapshot.provenance,
    error: snapshot.error,
    performance,
    technical,
    risk,
    fundamental,
    fundamentals,
    facts,
    sources,
    methodology:
      'Variación de precio entre cierres diarios: diario contra el cierre anterior; semanal contra siete días atrás; mensual y anual contra uno y doce meses calendario. Se usa el cierre previo disponible hasta siete días antes del objetivo. Se excluye la vela del día UTC actual. No incluye dividendos, comisiones ni conversión de moneda. El ajuste de splits es el informado por la fuente. El gráfico de TradingView tiene su propio feed y puede diferir.',
  };
}
export type AssetOverview = ReturnType<typeof buildAssetOverview>;
