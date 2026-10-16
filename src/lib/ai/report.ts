import { z } from 'zod';
import { technicalMetrics } from '../finance/indicators';
import type { MarketSnapshot, Provenance } from '../market/types';
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
  mode: 'deterministic' | 'ai';
  dataStatus: Provenance['status'];
  createdAt: string;
  dataAsOf: string;
  metrics: ReturnType<typeof technicalMetrics>;
  narrative: Narrative;
  sources: ResearchSource[];
  question?: string;
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
    mode: 'deterministic',
    dataStatus: snapshot.provenance.status,
    createdAt: new Date().toISOString(),
    dataAsOf: snapshot.provenance.asOf,
    metrics,
    sources: [source],
    narrative: {
      summary: neutral
        ? 'Las medias exponenciales rápida y lenta están al mismo nivel. No hay una dirección definida según esta comparación.'
        : `La media exponencial rápida se encuentra ${up ? 'por encima' : 'por debajo'} de la media lenta. Esta lectura describe el histórico disponible; no predice el próximo movimiento.`,
      fundamentalAnalysis:
        'No se emite una valoración fundamental sin estados financieros y períodos verificados.',
      technicalAnalysis: `La relación entre medias sugiere una tendencia ${neutral ? 'sin dirección definida' : up ? 'alcista' : 'bajista'}. El momentum y la amplitud de los movimientos deben revisarse junto con el volumen. Los niveles mostrados son extremos móviles del histórico, no soportes confirmados.`,
      macroContext: 'No se incorporaron series macroeconómicas verificadas a este informe.',
      risks: [
        'El comportamiento histórico no garantiza resultados futuros.',
        'Los niveles técnicos pueden invalidarse ante nueva información.',
        'La liquidez, las comisiones y los saltos de precio afectan los resultados.',
      ],
      catalysts: [],
      bullScenario:
        'La continuidad de máximos crecientes y la expansión del volumen respaldarían una hipótesis favorable.',
      baseScenario:
        'La consolidación entre los extremos recientes mantendría la lectura abierta hasta contar con más evidencia.',
      bearScenario:
        'La pérdida del mínimo reciente y el deterioro del momentum debilitarían la hipótesis favorable.',
      whatToWatch: [
        'Relación entre medias exponenciales.',
        'Extremos recientes y volumen relativo.',
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
