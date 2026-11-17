import { buildAssetOverview } from '../finance/asset-overview';
import {
  marketSnapshot,
  assetFundamentals,
  assetFinancialStatements,
  resolveInstrument,
} from './service';
import { YahooProvider } from './yahoo';

export async function assetOverview(id: string, demo = false) {
  const instrument = await resolveInstrument(id);
  const [initialSnapshot, fundamentals, financials] = await Promise.all([
    marketSnapshot(id, '1D', demo),
    assetFundamentals(instrument, demo),
    assetFinancialStatements(instrument, demo),
  ]);
  let snapshot = initialSnapshot;
  // Reuse the verified public history for research when no historical provider is configured.
  if (snapshot.provenance.status !== 'demo' && snapshot.candles.length === 0) {
    try {
      const history = await new YahooProvider().dailyHistory(instrument);
      snapshot = { ...snapshot, ...history, error: snapshot.quote ? undefined : snapshot.error };
    } catch {
      /* Preserve the source's unavailable state instead of substituting a series. */
    }
  }
  return buildAssetOverview(snapshot, fundamentals, financials);
}
