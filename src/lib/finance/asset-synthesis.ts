import type { FundamentalResearch } from '../market/public-fundamentals';
import type { AssetOverview } from './asset-overview';
import type { ChartIndicatorData } from './chart-indicators';
import { technicalBias } from './technical-bias';
export type SynthesisFact = { text: string; tone: 'positive' | 'warning' | 'negative' | 'neutral' };
export function assetSynthesis({
  fundamentals,
  technical,
  overview,
}: {
  fundamentals?: FundamentalResearch;
  technical?: ChartIndicatorData;
  overview?: AssetOverview;
}) {
  const metrics = fundamentals?.metrics ?? [];
  const value = (id: string) => metrics.find((m) => m.id === id)?.value;
  const income = value('netIncome'),
    cash = value('cashflow'),
    growth = value('growth');
  const annualGood = income != null && cash != null && income > 0 && cash > 0;
  const annualWeak = income != null && cash != null && income < 0 && cash < 0;
  const earnings = fundamentals?.earnings;
  const miss = !!earnings && earnings.actual < earnings.estimate;
  const beat = !!earnings && earnings.actual > earnings.estimate;
  const bias = technicalBias(technical);
  const volatility = overview?.risk.volatility;
  const highRisk = volatility != null && volatility >= 40;
  const strengths: SynthesisFact[] = [],
    attention: SynthesisFact[] = [],
    missing: string[] = [];
  const positive = (text: string) => strengths.push({ text, tone: 'positive' });
  const watch = (text: string, tone: SynthesisFact['tone'] = 'warning') =>
    attention.push({ text, tone });
  if (income != null) {
    if (income > 0) positive('El último ejercicio anual cerró con ganancias.');
    else if (income < 0) watch('El último ejercicio anual cerró con pérdidas.', 'negative');
  }
  if (cash != null) {
    if (cash > 0) positive('La actividad principal generó efectivo.');
    else if (cash < 0) watch('La actividad principal consumió efectivo.', 'negative');
  }
  if (growth != null) {
    if (growth > 0) positive('Los ingresos crecieron frente al ejercicio anterior comparable.');
    else if (growth < 0)
      watch('Los ingresos disminuyeron frente al ejercicio anterior comparable.', 'negative');
  }
  if (miss)
    watch(
      'El EPS del último trimestre informado quedó por debajo del consenso publicado.',
      'negative',
    );
  else if (beat) positive('El EPS del último trimestre informado superó el consenso publicado.');
  const latest = fundamentals?.periods[0];
  const prior = latest
    ? fundamentals?.periods.find(
        (p) =>
          p.currency === latest.currency &&
          Date.parse(latest.date) - Date.parse(p.date) >= 330 * 86400000 &&
          Date.parse(latest.date) - Date.parse(p.date) <= 400 * 86400000,
      )
    : undefined;
  if (
    latest?.values.FreeCashFlow != null &&
    prior?.values.FreeCashFlow != null &&
    latest.values.FreeCashFlow < prior.values.FreeCashFlow
  )
    watch('El flujo de caja libre disminuyó frente al ejercicio anual anterior.');
  if (bias.score !== null) {
    if (bias.score > 60)
      positive(
        'El RSI, el MACD y las medias muestran un sesgo conjunto alcista en el horizonte elegido.',
      );
    else if (bias.score < 40)
      watch(
        'El RSI, el MACD y las medias muestran un sesgo conjunto bajista en el horizonte elegido.',
        'negative',
      );
  }
  if (highRisk)
    watch('El precio presenta volatilidad histórica alta según el criterio de Cuantai.');
  if (
    technical?.close != null &&
    technical.trend.ema200 != null &&
    technical.close < technical.trend.ema200
  )
    watch('El último cierre está por debajo de la EMA 200, referencia de la tendencia de fondo.');
  if (fundamentals?.kind === 'stock' && (income == null || cash == null))
    missing.push(
      'Faltan resultados o flujo operativo anual para completar la lectura del negocio.',
    );
  if (fundamentals?.kind === 'stock' && !earnings)
    missing.push('No hay un consenso trimestral comparable disponible.');
  if (bias.score === null)
    missing.push('No hay historial suficiente para una lectura técnica conjunta.');
  if (volatility == null)
    missing.push('No hay muestra suficiente para medir la volatilidad histórica.');
  const fundamentalLabel = annualGood
    ? 'Ganancias y caja positivas'
    : annualWeak
      ? 'Pérdidas y consumo de caja'
      : income != null || cash != null
        ? 'Resultados mixtos o parciales'
        : fundamentals?.kind === 'crypto'
          ? 'Oferta y actividad de mercado'
          : fundamentals?.kind === 'etf'
            ? 'Exposición del fondo'
            : 'Cobertura fundamental incompleta';
  const fundamentalTone = annualGood ? 'positive' : annualWeak ? 'negative' : 'neutral';
  let title = 'Lectura parcial: conviene completar la evidencia disponible.';
  let tone: SynthesisFact['tone'] = 'neutral';
  if (annualGood) {
    title = miss
      ? 'Ganancias y caja positivas; último trimestre bajo el consenso.'
      : highRisk
        ? 'Negocio rentable, con volatilidad histórica elevada.'
        : beat
          ? 'Ganancias, generación de caja y un trimestre sobre el consenso.'
          : 'Negocio rentable y con generación de efectivo.';
    tone = miss || highRisk ? 'warning' : 'positive';
  } else if (annualWeak) {
    title = 'Pérdidas contables y consumo de efectivo en el último ejercicio.';
    tone = 'negative';
  } else if (income != null && cash != null) {
    title =
      income > 0 && cash < 0
        ? 'Ganancias contables, con salida de efectivo operativo.'
        : income < 0 && cash > 0
          ? 'Resultado contable débil, con generación de efectivo.'
          : income === 0 && cash === 0
            ? 'Resultado neto y flujo operativo en cero.'
            : 'Resultado contable y flujo operativo con señales diferentes.';
    tone = income === 0 && cash === 0 ? 'neutral' : 'warning';
  } else if (fundamentals?.kind === 'crypto' || fundamentals?.kind === 'etf') {
    title =
      fundamentals.kind === 'crypto'
        ? 'La lectura combina oferta, actividad y comportamiento del precio.'
        : 'La lectura combina exposición del fondo y comportamiento del precio.';
  }
  const riskLabel =
    volatility == null
      ? 'Sin lectura de riesgo'
      : volatility >= 40
        ? 'Volatilidad alta'
        : volatility >= 20
          ? 'Volatilidad intermedia'
          : 'Volatilidad baja';
  const summary: string[] = [];
  if (annualGood) summary.push('El negocio generó beneficios y efectivo en el último ejercicio.');
  else if (annualWeak)
    summary.push('La operación cerró el ejercicio con pérdidas y consumo de caja.');
  else if (income != null || cash != null)
    summary.push('El resultado contable y la caja operativa requieren una lectura separada.');
  if (bias.score !== null) {
    if (bias.score > 60)
      summary.push(
        annualGood
          ? 'La lectura técnica acompaña esa fortaleza en el horizonte elegido.'
          : 'Los indicadores de precio muestran un sesgo alcista en el horizonte elegido.',
      );
    else if (bias.score < 40)
      summary.push(
        annualGood
          ? 'El precio muestra debilidad técnica, pese al resultado operativo positivo.'
          : 'Los indicadores de precio muestran un sesgo bajista en el horizonte elegido.',
      );
    else
      summary.push(
        'La lectura técnica muestra equilibrio entre las señales del horizonte elegido.',
      );
  }
  if (miss)
    summary.push(
      'El último resultado trimestral fue inferior al consenso: es el punto débil de la comparación de resultados.',
    );
  else if (beat)
    summary.push('El último trimestre también superó las expectativas publicadas por el consenso.');
  if (highRisk)
    summary.push(
      'La volatilidad histórica alta añade una exposición mayor a las oscilaciones del precio.',
    );
  if (!summary.length)
    summary.push(
      'La cobertura disponible todavía no permite integrar una conclusión completa sobre el activo.',
    );
  return {
    title,
    summary,
    tone,
    fundamentalLabel,
    fundamentalTone,
    technicalLabel: bias.label,
    technicalTone:
      bias.score === null
        ? 'neutral'
        : bias.score > 60
          ? 'positive'
          : bias.score < 40
            ? 'negative'
            : 'neutral',
    riskLabel,
    riskTone:
      volatility == null
        ? 'neutral'
        : highRisk
          ? 'negative'
          : volatility >= 20
            ? 'warning'
            : 'positive',
    strengths,
    attention,
    missing,
  };
}
