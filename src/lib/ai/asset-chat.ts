import { z } from 'zod';
import type { AssetOverview, EvidenceFact } from '../finance/asset-overview';
import type { ResearchSource } from './report';
import type { NewsItem } from '../market/types';

export type ChatAnswer = {
  text: string;
  mode: 'ai' | 'rules';
  facts: EvidenceFact[];
  sources: ResearchSource[];
  notice: string;
};
export type ChatTurn = { id: string; question: string; answer: ChatAnswer; createdAt: string };
export const chatInputSchema = z
  .object({
    instrumentId: z.string().min(1).max(150),
    question: z.string().trim().min(1).max(1000),
    demo: z.boolean().default(false),
    baseTurnId: z.uuid().nullable(),
  })
  .strict();
export const chatOutputSchema = z.object({
  answer: z.string().min(1).max(4000),
  sourceIds: z.array(z.string()).max(10),
  factIds: z.array(z.string()).max(12),
});
export function validateChatOutput(
  value: unknown,
  sources: ResearchSource[],
  facts: EvidenceFact[],
) {
  const output = chatOutputSchema.parse(value);
  if (
    output.sourceIds.some((id) => !sources.some((s) => s.id === id)) ||
    output.factIds.some((id) => !facts.some((f) => f.id === id))
  )
    throw new Error('Referencias sin evidencia en la respuesta.');
  // As in research reports, numerical claims are rendered from server-computed facts only.
  if (/\d|https?:\/\//i.test(output.answer))
    throw new Error('Cifras o enlaces generados fuera de la evidencia.');
  if (sources.length && !output.sourceIds.length)
    throw new Error('La respuesta debe identificar la evidencia consultada.');
  return output;
}

export function rulesAnswer(
  overview: AssetOverview,
  question: string,
  history: ChatTurn[] = [],
  news: { items: NewsItem[]; error?: string } = { items: [] },
): ChatAnswer {
  const normalized = (text: string) =>
    text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  const topic = (text: string) =>
    /riesgo|volatil|caida/.test(text)
      ? 'risk'
      : /fundament|beneficio|ingreso|caja|barat|caro|empresa/.test(text)
        ? 'fundamental'
        : /noticia|titular/.test(text)
          ? 'news'
          : /rendim|semana|mensual|anual|diario|retorno/.test(text)
            ? 'returns'
            : /tecnic|tendencia|rsi|media|momentum|soporte|resistencia|macd/.test(text)
              ? 'technical'
              : /compr|vend|convien|invert/.test(text)
                ? 'decision'
                : null;
  const selected =
    topic(normalized(question)) ??
    (/eso|anterior|explica|por que/.test(normalized(question))
      ? topic(normalized(history.at(-1)?.question ?? ''))
      : null);
  const text =
    selected === 'risk'
      ? `${overview.risk.label}. ${overview.risk.conclusion} ${overview.risk.factors.join(' ')}`
      : selected === 'fundamental'
        ? `${overview.fundamental.conclusion} ${overview.fundamental.error ?? ''}`
        : selected === 'news'
          ? news.items.length
            ? 'Las publicaciones disponibles aparecen debajo con fecha y enlace original. Un titular aislado no prueba la causa de un movimiento de precio.'
            : (news.error ?? 'No hay noticias verificadas disponibles para este activo.')
          : selected === 'returns'
            ? `${overview.methodology} ${overview.performance
                .filter((p) => p.value === null)
                .map((p) => `${p.label}: ${p.reason}`)
                .join(' ')}`
            : selected === 'decision'
              ? `Para evaluar ${overview.instrument.symbol}, separá tu horizonte, cuánto podrías perder y qué evidencia invalidaría la tesis. ${overview.technical.conclusion} ${overview.risk.conclusion} Sin IA conectada no puedo elaborar una recomendación personalizada ni ponderar tu situación financiera.`
              : selected === 'technical'
                ? overview.technical.conclusion
                : `Esta consulta necesita interpretación de lenguaje con IA y el proveedor todavía no está conectado. Mientras tanto puedo calcular y explicar rendimiento, tendencia, momentum, riesgo, fundamentos disponibles y noticias de ${overview.instrument.symbol}. Probá una pregunta concreta sobre uno de esos temas.`;
  const factIds =
    selected === 'risk'
      ? ['volatility', 'drawdown']
      : selected === 'fundamental'
        ? ['revenue-growth']
        : selected === 'returns'
          ? overview.facts.filter((f) => f.id.startsWith('return-')).map((f) => f.id)
          : ['rsi'];
  return {
    text,
    mode: 'rules',
    facts: overview.facts.filter((f) => factIds.includes(f.id)),
    sources:
      selected === 'news'
        ? news.items
            .slice(0, 5)
            .map((item, index) => ({
              id: `news-${index}`,
              title: item.title,
              url: item.url,
              asOf: item.publishedAt,
              retrievedAt: new Date().toISOString(),
            }))
        : overview.sources,
    notice: `${overview.demo ? 'Datos sintéticos de demostración. Modo demo por reglas, sin consultar IA. ' : `${overview.stale ? 'El histórico está desactualizado. ' : ''}IA no configurada: respuesta por reglas sobre la evidencia disponible. `}No interpreta preguntas fuera de estos temas.`,
  };
}
