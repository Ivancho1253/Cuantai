import { z } from 'zod';
import { technicalMetrics } from '../finance/indicators';
import type { MarketSnapshot, Provenance } from '../market/types';
import type { ChatAnswer } from './asset-chat';
export const narrativeSchema = z.object({
  summary: z.string(),
  fundamentalAnalysis: z.string(),
  technicalAnalysis: z.string(),
  macroContext: z.string(),
  risks: z.array(z.string()),
  catalysts: z.array(z.string()),
  bullScenario: z.string(),
  baseScenario: z.string(),
  bearScenario: z.string(),
  whatToWatch: z.array(z.string()),
  sourceIds: z.array(z.string()),
  limitations: z.array(z.string()),
});
export type Narrative = z.infer<typeof narrativeSchema>;
export type ResearchSource = {
  id: string;
  title: string;
  url: string;
  asOf: string;
  retrievedAt: string;
};
export type AnalysisReport = {
  id: string;
  instrumentId: string;
  name: string;
  currency?: string;
  mode: 'deterministic' | 'ai';
  dataStatus: Provenance['status'];
  createdAt: string;
  dataAsOf: string;
  metrics: ReturnType<typeof technicalMetrics>;
  narrative: Narrative;
  sources: ResearchSource[];
  question?: string;
  answer?: ChatAnswer;
};
export function validateNarrative(value: unknown, sourceIds: string[]): Narrative {
  const narrative = narrativeSchema.parse(value);
  if (!narrative.sourceIds.length || narrative.sourceIds.some((id) => !sourceIds.includes(id)))
    throw new Error('El informe contiene referencias sin evidencia.');
  // Numerical claims live exclusively in deterministic metric cards. Reject generated figures.
  const { sourceIds: _ids, ...prose } = narrative;
  void _ids;
  if (/\d/.test(JSON.stringify(prose)))
    throw new Error('El informe contiene cifras generadas fuera de las métricas verificadas.');
  return narrative;
}
export function deterministicReport(snapshot: MarketSnapshot): AnalysisReport {
  const metrics = technicalMetrics(snapshot.candles);
  if (
    !metrics ||
    snapshot.candles.length < 50 ||
    !snapshot.provenance.source ||
    !snapshot.provenance.asOf
  )
    throw new Error(
      'No hay histórico suficiente para un análisis. Se requieren cincuenta velas y su procedencia.',
    );
  const up = metrics.trend === 'uptrend';
  const neutral = metrics.trend === 'neutral';
  const momentum =
    metrics.rsi === null
      ? 'No se pudo calcular el momentum relativo.'
      : metrics.rsi >= 70
        ? 'El momentum está en una zona elevada: puede acompañar una tendencia fuerte, pero deja menos margen frente a una corrección.'
        : metrics.rsi <= 30
          ? 'El momentum está deprimido. Esa condición muestra presión vendedora, sin confirmar un piso ni un rebote.'
          : 'El momentum se mantiene fuera de los extremos convencionales; la dirección debe contrastarse con las medias.';
  const aligned = metrics.macd !== null && !neutral && (up ? metrics.macd > 0 : metrics.macd < 0);
  const impulse =
    metrics.macd === null
      ? 'No hay lectura disponible del histograma MACD.'
      : neutral
        ? 'El histograma MACD debe interpretarse sin atribuir una tendencia a medias que están al mismo nivel.'
        : aligned
          ? 'El histograma MACD acompaña la dirección de las medias: ambas señales están alineadas en este cierre.'
          : 'El histograma MACD no acompaña la dirección de las medias. Esa divergencia reduce la coherencia de la lectura y merece seguimiento.';
  const position =
    metrics.ema20 === null
      ? ''
      : metrics.close >= metrics.ema20
        ? 'El último cierre está sobre la media rápida, una condición compatible con fortaleza de corto plazo.'
        : 'El último cierre está bajo la media rápida, lo que señala debilidad de corto plazo aun si la tendencia más lenta fuera alcista.';
  const source = {
    id: 'market',
    title: snapshot.provenance.source,
    url: snapshot.provenance.url,
    asOf: snapshot.provenance.asOf,
    retrievedAt: snapshot.provenance.retrievedAt,
  };
  return {
    id: crypto.randomUUID(),
    instrumentId: snapshot.instrument.id,
    name: snapshot.instrument.name,
    currency: snapshot.instrument.currency,
    mode: 'deterministic',
    dataStatus: snapshot.provenance.status,
    createdAt: new Date().toISOString(),
    dataAsOf: snapshot.provenance.asOf,
    metrics,
    sources: [source],
    narrative: {
      summary: neutral
        ? 'Las medias exponenciales rápida y lenta están al mismo nivel. No hay una dirección definida según esta comparación.'
        : `El sesgo del histórico es ${up ? 'alcista' : 'bajista'} por la relación entre las medias. ${impulse} ${position}`,
      fundamentalAnalysis:
        'No se emite una valoración fundamental sin estados financieros y períodos verificados.',
      technicalAnalysis: `La relación entre medias sugiere una tendencia ${neutral ? 'sin dirección definida' : up ? 'alcista' : 'bajista'}. ${momentum} ${impulse} Los niveles mostrados son extremos móviles del histórico, no soportes confirmados.`,
      macroContext: 'No se incorporaron series macroeconómicas verificadas a este informe.',
      risks: [
        ...(!neutral && !aligned
          ? [
              'La tendencia y el impulso no están alineados: una sola señal puede exagerar la convicción.',
            ]
          : []),
        ...(metrics.rsi !== null && metrics.rsi >= 70
          ? [
              'El momentum elevado aumenta la importancia de revisar correcciones y cierres frente a la media rápida.',
            ]
          : []),
        'El comportamiento histórico no garantiza resultados futuros.',
        'Los niveles técnicos pueden invalidarse ante nueva información.',
        'La liquidez, las comisiones y los saltos de precio afectan los resultados.',
      ],
      catalysts: [],
      bullScenario: up
        ? 'Mantener cierres sobre la media rápida y superar el máximo reciente con participación del volumen reforzaría la continuidad alcista.'
        : 'La hipótesis de recuperación requiere primero recuperar la media rápida y después superar el máximo reciente. Un rebote aislado dentro del rango no basta.',
      baseScenario:
        'La consolidación entre los extremos recientes mantendría la lectura abierta hasta contar con más evidencia.',
      bearScenario: up
        ? 'Perder la media rápida y cerrar debajo del mínimo reciente debilitaría la estructura alcista. El deterioro conjunto del impulso daría más consistencia a esa lectura.'
        : 'Permanecer bajo la media rápida y perforar el mínimo reciente sería compatible con continuidad de la presión vendedora. Recuperar el rango contradiría esa lectura.',
      whatToWatch: [
        'Si el siguiente cierre conserva o pierde su posición frente a la media rápida.',
        aligned
          ? 'Si el histograma MACD mantiene la alineación con la tendencia.'
          : 'Si el histograma MACD converge con las medias o profundiza la divergencia.',
        'Una salida del rango reciente acompañada de volumen, diferenciándola de una oscilación dentro del rango.',
        'Resultados y comunicaciones del emisor, cuando corresponda.',
      ],
      sourceIds: ['market'],
      limitations: [
        ...(snapshot.provenance.status === 'demo'
          ? ['Dataset sintético de demostración. No constituye una lectura del mercado actual.']
          : []),
        ...(snapshot.provenance.status !== 'demo' &&
        Date.now() - Date.parse(snapshot.provenance.asOf) > 4 * 86400000
          ? [
              'El histórico está desactualizado; verificá una fuente más reciente antes de interpretar esta lectura.',
            ]
          : []),
        'Informe técnico determinístico; no fue redactado por un modelo de IA.',
        'Sin valoración DCF, guidance ni contexto macroeconómico verificado.',
      ],
    },
  };
}
