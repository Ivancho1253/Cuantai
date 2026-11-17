import { expect, it, vi, afterEach } from 'vitest';
import { assetOverview } from '@/lib/market/asset-overview';
import {
  resolveInstrument,
  marketSnapshot,
  assetFundamentals,
  assetFinancialStatements,
} from '@/lib/market/service';
import { YahooProvider } from '@/lib/market/yahoo';
import { instruments } from '@/lib/market/catalog';
import { demoHistory } from '@/lib/market/demo';
vi.mock('@/lib/market/service', () => ({
  resolveInstrument: vi.fn(),
  marketSnapshot: vi.fn(),
  assetFundamentals: vi.fn(),
  assetFinancialStatements: vi.fn(),
}));
afterEach(() => vi.restoreAllMocks());
it('adds verified public history to live research without creating a missing quote', async () => {
  const instrument = instruments.find((i) => i.symbol === 'AMZN')!;
  vi.mocked(resolveInstrument).mockResolvedValue(instrument);
  vi.mocked(assetFundamentals).mockResolvedValue({
    metrics: [],
    error: 'No configured fundamentals',
  });
  vi.mocked(assetFinancialStatements).mockResolvedValue({
    data: null,
    reason: 'UNAVAILABLE',
    error: 'Not configured',
  });
  const seed = demoHistory(instrument);
  const snapshot = {
    ...seed,
    candles: [],
    quote: null,
    provenance: { ...seed.provenance, status: 'unavailable' as const },
    error: 'History and quote unavailable',
  };
  vi.mocked(marketSnapshot).mockResolvedValue(snapshot);
  const provider = vi
    .spyOn(YahooProvider.prototype, 'dailyHistory')
    .mockResolvedValue({
      candles: seed.candles,
      provenance: {
        ...seed.provenance,
        source: 'Verified test history',
        status: 'delayed',
        delayMinutes: null,
        adjusted: 'unknown',
      },
    });
  const live = await assetOverview(instrument.id);
  expect(live.provenance.source).toBe('Verified test history');
  expect(live.quote).toBeNull();
  expect(live.technical.metrics).not.toBeNull();
  expect(live.demo).toBe(false);
  expect(provider).toHaveBeenCalledTimes(1);
  vi.mocked(marketSnapshot).mockResolvedValue(seed);
  const demo = await assetOverview(instrument.id, true);
  expect(demo.demo).toBe(true);
  expect(provider).toHaveBeenCalledTimes(1);
});
