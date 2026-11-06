import { buildAssetOverview } from '../finance/asset-overview';
import {
  marketSnapshot,
  assetFundamentals,
  assetFinancialStatements,
  resolveInstrument,
} from './service';

export async function assetOverview(id: string, demo = false) {
  const instrument = await resolveInstrument(id);
  const [snapshot, fundamentals, financials] = await Promise.all([
    marketSnapshot(id, '1D', demo),
    assetFundamentals(instrument, demo),
    assetFinancialStatements(instrument, demo),
  ]);
  return buildAssetOverview(snapshot, fundamentals, financials);
}
