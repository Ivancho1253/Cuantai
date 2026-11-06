import Decimal from 'decimal.js';
import { z } from 'zod';

const day = z.iso.date();
const factSchema = z.object({
  start: day.optional(),
  end: day,
  val: z.number().finite(),
  accn: z.string().regex(/^\d{10}-\d{2}-\d{6}$/),
  form: z.string(),
  filed: day,
});
const conceptSchema = z.object({
  units: z.record(z.string(), z.array(z.unknown())),
});
export const companyFactsSchema = z.object({
  cik: z.number().int().positive().max(9999999999),
  entityName: z.string().min(1).max(300),
  facts: z.record(z.string(), z.record(z.string(), z.unknown())),
});
export type CompanyFacts = z.infer<typeof companyFactsSchema>;
type RawFact = z.infer<typeof factSchema>;
export type StatementSection = 'income' | 'balance' | 'cashflow';
export type FinancialPeriod = {
  id: string;
  start: string;
  end: string;
  accession: string;
  filed: string;
  form: string;
  url: string;
};
export type FinancialFact = {
  value: string;
  unit: string;
  tags: string[];
  derived: boolean;
};
export type FinancialRow = {
  id: string;
  label: string;
  section: StatementSection;
  unit: string;
  values: Record<string, FinancialFact | null>;
};
export type FinancialStatements = {
  cik: string;
  entityName: string;
  issuerInstrumentId: string;
  requestedInstrumentId: string;
  retrievedAt: string;
  sourceUrl: string;
  delivery: 'sec-api' | 'imported-snapshot';
  periods: FinancialPeriod[];
  rows: FinancialRow[];
  warnings: string[];
};
export type FinancialStatementsResult = {
  data: FinancialStatements | null;
  reason?: 'DEMO' | 'NOT_APPLICABLE' | 'UNAVAILABLE';
  error?: string;
};
export interface FinancialStatementsProvider {
  statements(instrument: import('../market/types').Instrument): Promise<FinancialStatements>;
}
type RowSpec = {
  id: string;
  label: string;
  section: StatementSection;
  tags: string[];
  unit: string;
  instant?: boolean;
};
const specs: RowSpec[] = [
  {
    id: 'revenue',
    label: 'Ingresos',
    section: 'income',
    unit: 'USD',
    tags: ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet'],
  },
  {
    id: 'grossProfit',
    label: 'Resultado bruto',
    section: 'income',
    unit: 'USD',
    tags: ['GrossProfit'],
  },
  {
    id: 'operatingIncome',
    label: 'Resultado operativo',
    section: 'income',
    unit: 'USD',
    tags: ['OperatingIncomeLoss'],
  },
  {
    id: 'netIncome',
    label: 'Resultado neto atribuible a la controladora',
    section: 'income',
    unit: 'USD',
    tags: ['NetIncomeLoss'],
  },
  {
    id: 'epsDiluted',
    label: 'Ganancia diluida por acción',
    section: 'income',
    unit: 'USD/shares',
    tags: ['EarningsPerShareDiluted'],
  },
  {
    id: 'assets',
    label: 'Activos totales',
    section: 'balance',
    unit: 'USD',
    instant: true,
    tags: ['Assets'],
  },
  {
    id: 'liabilities',
    label: 'Pasivos totales',
    section: 'balance',
    unit: 'USD',
    instant: true,
    tags: ['Liabilities'],
  },
  {
    id: 'equity',
    label: 'Patrimonio atribuible a la controladora',
    section: 'balance',
    unit: 'USD',
    instant: true,
    tags: ['StockholdersEquity'],
  },
  {
    id: 'cash',
    label: 'Efectivo y equivalentes',
    section: 'balance',
    unit: 'USD',
    instant: true,
    tags: ['CashAndCashEquivalentsAtCarryingValue'],
  },
  {
    id: 'currentAssets',
    label: 'Activos corrientes',
    section: 'balance',
    unit: 'USD',
    instant: true,
    tags: ['AssetsCurrent'],
  },
  {
    id: 'currentLiabilities',
    label: 'Pasivos corrientes',
    section: 'balance',
    unit: 'USD',
    instant: true,
    tags: ['LiabilitiesCurrent'],
  },
  {
    id: 'operatingCashFlow',
    label: 'Flujo de actividades operativas',
    section: 'cashflow',
    unit: 'USD',
    tags: ['NetCashProvidedByUsedInOperatingActivities'],
  },
  {
    id: 'investingCashFlow',
    label: 'Flujo de actividades de inversión',
    section: 'cashflow',
    unit: 'USD',
    tags: ['NetCashProvidedByUsedInInvestingActivities'],
  },
  {
    id: 'financingCashFlow',
    label: 'Flujo de actividades de financiación',
    section: 'cashflow',
    unit: 'USD',
    tags: ['NetCashProvidedByUsedInFinancingActivities'],
  },
  {
    id: 'capex',
    label: 'Pagos por propiedad, planta y equipo',
    section: 'cashflow',
    unit: 'USD',
    tags: ['PaymentsToAcquirePropertyPlantAndEquipment'],
  },
];
const daysBetween = (start: string, end: string) =>
  (Date.parse(end) - Date.parse(start)) / 86400000 + 1;
const annual = (f: RawFact) =>
  Boolean(f.start && daysBetween(f.start, f.end) >= 335 && daysBetween(f.start, f.end) <= 395);
export const companyFactsUrl = (cik: string | number) =>
  `https://data.sec.gov/api/xbrl/companyfacts/CIK${String(cik).padStart(10, '0')}.json`;

/** Each column uses one annual filing and exact context dates, never mixed filing versions. */
export function normalizeStatements(
  input: unknown,
  options: {
    instrumentId: string;
    requestedInstrumentId?: string;
    retrievedAt: string;
    financialSector: boolean;
    sectorKnown?: boolean;
    delivery: FinancialStatements['delivery'];
  },
): FinancialStatements {
  const data = companyFactsSchema.parse(input);
  const retrievedAt = z.iso.datetime().parse(options.retrievedAt);
  const cutoff = retrievedAt.slice(0, 10);
  const warnings = new Set<string>();
  const taxonomy = data.facts['us-gaap'] ?? {};
  const excludeGenericOperatingMetrics = options.financialSector || options.sectorKnown === false;
  const selectedSpecs = excludeGenericOperatingMetrics
    ? specs.filter((s) => !['revenue', 'grossProfit', 'operatingIncome', 'capex'].includes(s.id))
    : specs;
  const factsByTag = new Map<string, RawFact[]>();
  for (const spec of selectedSpecs)
    for (const tag of spec.tags) {
      const concept = conceptSchema.safeParse(taxonomy[tag]);
      const facts: RawFact[] = [];
      for (const raw of concept.success ? (concept.data.units[spec.unit] ?? []) : []) {
        const parsed = factSchema.safeParse(raw);
        if (!parsed.success) continue;
        const f = parsed.data;
        if (
          !['10-K', '10-K/A'].includes(f.form) ||
          f.filed > cutoff ||
          f.end > f.filed ||
          (f.start && f.start > f.end)
        )
          continue;
        if (Number.isInteger(f.val) && !Number.isSafeInteger(f.val)) {
          warnings.add('Se omitieron cifras fuera del rango entero seguro del JSON de origen.');
          continue;
        }
        facts.push(f);
      }
      factsByTag.set(tag, facts);
    }
  const durationFacts = selectedSpecs
    .filter((s) => !s.instant)
    .flatMap((s) =>
      s.tags.flatMap((tag) => (factsByTag.get(tag) ?? []).map((fact) => ({ ...fact, tag }))),
    )
    .filter(annual);
  const byFiling = new Map<string, (RawFact & { tag: string })[]>();
  for (const fact of durationFacts)
    byFiling.set(fact.accn, [...(byFiling.get(fact.accn) ?? []), fact]);
  const byEnd = new Map<string, FinancialPeriod>();
  for (const [accession, facts] of byFiling) {
    if (new Set(facts.map((f) => `${f.filed}:${f.form}`)).size !== 1) {
      warnings.add(
        `Se omitió ${accession} porque su fecha o tipo de presentación son contradictorios.`,
      );
      continue;
    }
    const end = facts.reduce((latest, f) => (f.end > latest ? f.end : latest), '');
    const contexts = new Map<string, number>();
    const counted = new Set<string>();
    for (const f of facts.filter((f) => f.end === end)) {
      const key = `${f.tag}:${f.start}`;
      if (counted.has(key)) continue;
      counted.add(key);
      contexts.set(f.start!, (contexts.get(f.start!) ?? 0) + 1);
    }
    const start = [...contexts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
    const anchor = facts.find((f) => f.end === end && f.start === start)!;
    const period: FinancialPeriod = {
      id: end,
      start,
      end,
      accession,
      filed: anchor.filed,
      form: anchor.form,
      url: `https://www.sec.gov/Archives/edgar/data/${data.cik}/${accession.replaceAll('-', '')}/${accession}-index.html`,
    };
    const previous = byEnd.get(end);
    if (
      !previous ||
      period.filed > previous.filed ||
      (period.filed === previous.filed && accession > previous.accession)
    )
      byEnd.set(end, period);
  }
  const periods = [...byEnd.values()].sort((a, b) => b.end.localeCompare(a.end)).slice(0, 5);
  const rows: FinancialRow[] = selectedSpecs.map((spec) => ({
    id: spec.id,
    label: spec.label,
    section: spec.section,
    unit: spec.unit,
    values: Object.fromEntries(
      periods.map((period) => {
        for (const tag of spec.tags) {
          const matches = (factsByTag.get(tag) ?? []).filter(
            (f) =>
              f.accn === period.accession &&
              f.filed === period.filed &&
              f.form === period.form &&
              f.end === period.end &&
              (spec.instant ? !f.start : f.start === period.start),
          );
          if (!matches.length) continue;
          const values = new Set(matches.map((f) => new Decimal(f.val).toString()));
          if (values.size !== 1) {
            warnings.add(
              `${spec.label} · ${period.end}: hay valores contradictorios para el mismo contexto; no se eligió uno.`,
            );
            return [period.id, null];
          }
          return [
            period.id,
            {
              value: [...values][0],
              unit: spec.unit,
              tags: [`us-gaap:${tag}`],
              derived: false,
            } satisfies FinancialFact,
          ];
        }
        return [period.id, null];
      }),
    ),
  }));
  if (!excludeGenericOperatingMetrics)
    rows.push({
      id: 'freeCashFlow',
      label: 'Flujo libre simplificado · operativo − PP&E',
      section: 'cashflow',
      unit: 'USD',
      values: Object.fromEntries(
        periods.map((p) => {
          const operating = rows.find((r) => r.id === 'operatingCashFlow')?.values[p.id];
          const capex = rows.find((r) => r.id === 'capex')?.values[p.id];
          return [
            p.id,
            operating && capex && new Decimal(capex.value).gte(0)
              ? ({
                  value: new Decimal(operating.value).minus(capex.value).toString(),
                  unit: 'USD',
                  tags: [...operating.tags, ...capex.tags],
                  derived: true,
                } satisfies FinancialFact)
              : null,
          ];
        }),
      ),
    });
  if (options.financialSector)
    warnings.add(
      'Sector financiero: no se aplican ingresos, margen operativo ni flujo libre genéricos de empresas no financieras.',
    );
  if (options.sectorKnown === false)
    warnings.add(
      'El sector del emisor no está verificado en el catálogo; se omiten métricas operativas y flujo libre genéricos.',
    );
  if (periods.some((p) => p.form === '10-K/A'))
    warnings.add(
      'Hay una presentación anual modificada. Solo se muestran los conceptos presentes en esa versión; no se rellenan con la presentación anterior.',
    );
  if (periods[0] && Date.now() - Date.parse(periods[0].end) > 550 * 86400000)
    warnings.add('El último ejercicio disponible cerró hace más de 550 días.');
  if (Date.now() - Date.parse(retrievedAt) > 30 * 86400000)
    warnings.add(
      'La fuente fue recuperada hace más de treinta días; puede no incluir presentaciones posteriores.',
    );
  return {
    cik: String(data.cik).padStart(10, '0'),
    entityName: data.entityName,
    issuerInstrumentId: options.instrumentId,
    requestedInstrumentId: options.requestedInstrumentId ?? options.instrumentId,
    retrievedAt,
    sourceUrl: companyFactsUrl(data.cik),
    delivery: options.delivery,
    periods,
    rows,
    warnings: [...warnings],
  };
}
