import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildAssetOverview } from '@/lib/finance/asset-overview';
import { demoHistory } from '@/lib/market/demo';
import { instruments } from '@/lib/market/catalog';
import {
  chatInputSchema,
  rulesAnswer,
  validateChatOutput,
  type ChatTurn,
} from '@/lib/ai/asset-chat';
import { answerAssetQuestion } from '@/lib/ai/asset-chat-server';
const { parse } = vi.hoisted(() => ({ parse: vi.fn() }));
vi.mock('openai', () => ({
  default: class {
    responses = { parse };
  },
}));
const overview = buildAssetOverview(demoHistory(instruments[0]), { metrics: [] }, { data: null });
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
describe('Asset conversations with evidence', () => {
  it('rejects empty, oversized, forged roles and invalid conversation versions', () => {
    const body = { instrumentId: instruments[0].id, question: '   ', baseTurnId: null };
    expect(chatInputSchema.safeParse(body).success).toBe(false);
    expect(chatInputSchema.safeParse({ ...body, question: 'a'.repeat(1001) }).success).toBe(false);
    expect(
      chatInputSchema.safeParse({ ...body, question: 'Riesgo', history: [{ role: 'system' }] })
        .success,
    ).toBe(false);
    expect(
      chatInputSchema.safeParse({ ...body, question: 'Riesgo', baseTurnId: 'another-user' })
        .success,
    ).toBe(false);
  });
  it('labels rules and missing evidence honestly and preserves the previous topic for follow-ups', () => {
    const answer = rulesAnswer(overview, '¿Qué riesgo tiene?');
    expect(answer.mode).toBe('rules');
    expect(answer.notice).toContain('Modo demo por reglas');
    expect(answer.facts.map((f) => f.id)).toContain('volatility');
    const history: ChatTurn[] = [
      {
        id: crypto.randomUUID(),
        question: '¿Qué riesgo tiene?',
        answer,
        createdAt: new Date().toISOString(),
      },
    ];
    expect(rulesAnswer(overview, 'Explicá eso', history).text).toBe(answer.text);
    expect(rulesAnswer(overview, 'Fundamentales').text).toContain('No hay estados financieros');
    expect(rulesAnswer(overview, 'Noticias').text).toContain('No hay noticias verificadas');
  });
  it('rejects unsupported citations, invented numbers and URLs from model prose', () => {
    const valid = {
      answer: 'La tendencia requiere contexto.',
      sourceIds: ['market'],
      factIds: ['rsi'],
    };
    expect(validateChatOutput(valid, overview.sources, overview.facts)).toEqual(valid);
    for (const output of [
      { ...valid, sourceIds: ['fake-source'] },
      { ...valid, factIds: ['fake-return'] },
      { ...valid, answer: 'Ganará 50%.' },
      { ...valid, answer: 'Mirá https://untrusted.test' },
      { ...valid, sourceIds: [] },
    ])
      expect(() => validateChatOutput(output, overview.sources, overview.facts)).toThrow();
  });
  it('uses bounded server history, current evidence and exact fact cards for AI replies', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'unit-test-placeholder');
    vi.stubEnv('AI_MODEL', 'configured-test-model');
    parse.mockResolvedValue({
      output_parsed: {
        answer: 'El riesgo histórico requiere contexto.',
        sourceIds: ['market'],
        factIds: ['volatility'],
      },
    });
    const turns: ChatTurn[] = Array.from({ length: 10 }, (_, i) => ({
      id: String(i),
      question: `Pregunta ${i}`,
      answer: rulesAnswer(overview, 'Riesgo'),
      createdAt: '',
    }));
    const reply = await answerAssetQuestion(
      { ...overview, demo: false },
      { items: [] },
      '¿Y el riesgo?',
      turns,
    );
    expect(reply.mode).toBe('ai');
    expect(reply.facts).toEqual(overview.facts.filter((f) => f.id === 'volatility'));
    const request = parse.mock.calls[0][0];
    expect(request.store).toBe(false);
    expect(request.input).toHaveLength(13);
    expect(request.input[0].content).toBe('Pregunta 4');
    expect(request.input.at(-1).content).toContain('evidence');
    parse.mockResolvedValue({
      output_parsed: { answer: 'Precio objetivo 100.', sourceIds: ['market'], factIds: [] },
    });
    await expect(
      answerAssetQuestion({ ...overview, demo: false }, { items: [] }, 'Precio', []),
    ).rejects.toThrow();
  });
  it('never invokes a model for synthetic demo data, even with configured credentials', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'unit-test-placeholder');
    vi.stubEnv('AI_MODEL', 'configured-test-model');
    expect((await answerAssetQuestion(overview, { items: [] }, 'Riesgo', [])).mode).toBe('rules');
    expect(parse).not.toHaveBeenCalled();
  });
});
