import { afterEach, expect, it, vi } from 'vitest';
import { createAnalysis } from '@/lib/ai/analysis';
import { demoHistory } from '@/lib/market/demo';
import { instruments } from '@/lib/market/catalog';
import {
  marketSnapshot,
  assetFundamentals,
  assetFinancialStatements,
  marketNews,
} from '@/lib/market/service';
vi.mock('@/lib/market/service', () => ({
  marketSnapshot: vi.fn(),
  assetFundamentals: vi.fn(),
  assetFinancialStatements: vi.fn(),
  marketNews: vi.fn(),
}));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
it('answers the submitted question without an AI key and keeps original news sources', async () => {
  vi.stubEnv('OPENAI_API_KEY', '');
  vi.stubEnv('AI_MODEL', '');
  vi.mocked(marketSnapshot).mockResolvedValue(demoHistory(instruments[0]));
  vi.mocked(assetFundamentals).mockResolvedValue({ metrics: [], error: 'No fundamentals' });
  vi.mocked(assetFinancialStatements).mockResolvedValue({
    data: null,
    error: 'No financial statements',
  });
  vi.mocked(marketNews).mockResolvedValue({
    items: [
      {
        id: 'one',
        title: 'Issuer statement',
        url: 'https://issuer.test/news',
        source: 'Issuer',
        publishedAt: '2026-11-12T12:00:00Z',
        category: 'Earnings',
      },
    ],
  });
  const report = await createAnalysis(instruments[0].id, '¿Qué riesgo tiene?');
  expect(report.mode).toBe('deterministic');
  expect(report.question).toBe('¿Qué riesgo tiene?');
  expect(report.answer?.mode).toBe('rules');
  expect(report.answer?.facts.some((f) => f.id === 'volatility')).toBe(true);
  expect(report.sources.some((s) => s.url === 'https://issuer.test/news')).toBe(true);
});
