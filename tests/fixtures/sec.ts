// Synthetic SEC-shaped test data. Never used by the application or presented as live facts.
export function secFixture() {
  const duration = (year: number, val: number) => ({
    start: `${year}-01-01`,
    end: `${year}-12-31`,
    val,
    accn: `0000123456-${String(year + 1).slice(2)}-000001`,
    form: '10-K',
    filed: `${year + 1}-02-01`,
    fy: year,
    fp: 'FY',
  });
  const annual = (amount: number) =>
    [2023, 2024, 2025].map((year) => duration(year, amount + (year - 2023) * 1000000));
  const instant = (amount: number) =>
    annual(amount).map(({ start: _start, ...fact }) => {
      void _start;
      return fact;
    });
  const monetary = <T>(values: T[]) => ({
    units: { USD: values },
  });
  return {
    cik: 123456,
    entityName: 'Cuantai synthetic test issuer',
    facts: {
      'us-gaap': {
        RevenueFromContractWithCustomerExcludingAssessedTax: monetary(annual(10000000)),
        GrossProfit: monetary(annual(6000000)),
        OperatingIncomeLoss: monetary(annual(3000000)),
        NetIncomeLoss: monetary(annual(2000000)),
        EarningsPerShareDiluted: {
          units: { 'USD/shares': [2023, 2024, 2025].map((year) => duration(year, 2.5)) },
        },
        Assets: monetary(instant(50000000)),
        Liabilities: monetary(instant(30000000)),
        StockholdersEquity: monetary(instant(20000000)),
        CashAndCashEquivalentsAtCarryingValue: monetary(instant(1000000)),
        AssetsCurrent: monetary(instant(10000000)),
        LiabilitiesCurrent: monetary(instant(5000000)),
        NetCashProvidedByUsedInOperatingActivities: monetary(annual(4000000)),
        NetCashProvidedByUsedInInvestingActivities: monetary(annual(-2000000)),
        NetCashProvidedByUsedInFinancingActivities: monetary(annual(-1000000)),
        PaymentsToAcquirePropertyPlantAndEquipment: monetary(annual(1000000)),
      },
    },
  };
}
export const secDirectoryFixture = {
  fields: ['cik', 'name', 'ticker', 'exchange'],
  data: [[123456, 'Cuantai synthetic test issuer', 'AAPL', 'Nasdaq']],
};
export function secBundleFixture() {
  return {
    retrievedAt: '2026-10-16T00:00:00Z',
    companyTickers: secDirectoryFixture,
    companyFacts: [secFixture()],
  };
}
