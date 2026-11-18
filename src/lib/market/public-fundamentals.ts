import { earningsComparison, type EarningsComparison } from './earnings-comparison';
import { z } from 'zod';
import { cached, fetchJson } from './transport';
import { yahooSymbol } from './yahoo';
import type { Instrument } from './types';
import cryptoCatalog from './data/crypto.json';

export type ResearchMetric = {
  id: string;
  label: string;
  value: number;
  unit: string;
  explanation: string;
};
export type ResearchPeriod = { date: string; currency: string; values: Record<string, number> };
export type FundamentalResearch = {
  instrumentId: string;
  issuer: string;
  kind: Instrument['type'];
  source: string;
  url: string;
  asOf: string | null;
  retrievedAt: string;
  periods: ResearchPeriod[];
  metrics: ResearchMetric[];
  title: string;
  conclusion: string;
  coverage: string[];
  error?: string;
  earnings?: EarningsComparison;
};
export const financialConcepts = [
  ['TotalRevenue', 'Ingresos', 'income'],
  ['GrossProfit', 'Resultado bruto', 'income'],
  ['OperatingIncome', 'Resultado operativo', 'income'],
  ['NetIncome', 'Resultado neto', 'income'],
  ['DilutedEPS', 'Ganancia diluida por acción', 'income'],
  ['TotalAssets', 'Activos totales', 'balance'],
  ['TotalLiabilitiesNetMinorityInterest', 'Pasivos totales', 'balance'],
  ['StockholdersEquity', 'Patrimonio neto', 'balance'],
  ['TotalDebt', 'Deuda total', 'balance'],
  [
    'CashCashEquivalentsAndShortTermInvestments',
    'Efectivo e inversiones de corto plazo',
    'balance',
  ],
  ['OperatingCashFlow', 'Flujo operativo', 'cashflow'],
  ['CapitalExpenditure', 'Inversión en capital', 'cashflow'],
  ['FreeCashFlow', 'Flujo de caja libre', 'cashflow'],
] as const;

const responseSchema = z.object({
  timeseries: z.object({
    result: z
      .array(
        z
          .object({ meta: z.object({ symbol: z.array(z.string()), type: z.array(z.string()) }) })
          .catchall(z.unknown()),
      )
      .nullable(),
    error: z.unknown().optional(),
  }),
});
const factSchema = z.object({
  asOfDate: z.iso.date(),
  periodType: z.literal('12M'),
  currencyCode: z.string().min(1),
  reportedValue: z.object({ raw: z.number().finite() }),
});

// Never join values across dates or currencies, or silently turn missing facts into zero.
export function parsePublicPeriods(
  input: unknown,
  symbol: string,
  now = Date.now(),
): ResearchPeriod[] {
  const data = responseSchema.parse(input);
  if (data.timeseries.error) throw new Error('La fuente no devolvió estados financieros.');
  const periods = new Map<string, ResearchPeriod>();
  for (const series of data.timeseries.result ?? []) {
    if (
      series.meta.symbol.length !== 1 ||
      series.meta.symbol[0].toUpperCase() !== symbol.toUpperCase()
    )
      throw new Error('El emisor devuelto no coincide con el solicitado.');
    const key = series.meta.type[0];
    if (!financialConcepts.some(([id]) => key === 'annual' + id)) continue;
    const raw = series[key];
    if (!Array.isArray(raw)) continue;
    for (const inputFact of raw) {
      const parsed = factSchema.safeParse(inputFact);
      if (!parsed.success || Date.parse(parsed.data.asOfDate) > now) continue;
      const f = parsed.data,
        id = f.asOfDate + ':' + f.currencyCode;
      const period = periods.get(id) ?? { date: f.asOfDate, currency: f.currencyCode, values: {} };
      period.values[key.slice(6)] = f.reportedValue.raw;
      periods.set(id, period);
    }
  }
  return [...periods.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
}
export function corporateMetrics(periods: ResearchPeriod[]): ResearchMetric[] {
  const latest = periods[0];
  if (!latest) return [];
  const v = latest.values,
    result: ResearchMetric[] = [];
  const add = (
    id: string,
    label: string,
    value: number | undefined,
    unit: string,
    explanation: string,
  ) => {
    if (value != null && Number.isFinite(value))
      result.push({ id, label, value, unit, explanation });
  };
  add(
    'revenue',
    'Ingresos anuales',
    v.TotalRevenue,
    latest.currency,
    'Ventas del ejercicio fiscal informado.',
  );
  add(
    'netIncome',
    'Resultado neto',
    v.NetIncome,
    latest.currency,
    'Positivo: ganancias contables; negativo: pérdidas del ejercicio.',
  );
  add(
    'cashflow',
    'Flujo operativo',
    v.OperatingCashFlow,
    latest.currency,
    'Efectivo generado o consumido por la actividad principal.',
  );
  add(
    'fcf',
    'Flujo de caja libre',
    v.FreeCashFlow,
    latest.currency,
    'Efectivo después de la inversión en capital, según la fuente.',
  );
  if (v.TotalRevenue > 0)
    add(
      'margin',
      'Margen neto',
      (v.NetIncome / v.TotalRevenue) * 100,
      '%',
      'Resultado neto dividido por ingresos. Mide la ganancia por cada 100 de ventas.',
    );
  const prior = periods.find(
    (p) =>
      p.currency === latest.currency &&
      Date.parse(latest.date) - Date.parse(p.date) >= 330 * 86400000 &&
      Date.parse(latest.date) - Date.parse(p.date) <= 400 * 86400000,
  );
  if (prior && prior.values.TotalRevenue > 0)
    add(
      'growth',
      'Crecimiento de ingresos',
      (v.TotalRevenue / prior.values.TotalRevenue - 1) * 100,
      '%',
      'Variación respecto del ejercicio anual anterior, en la misma moneda de reporte.',
    );
  if (v.StockholdersEquity > 0)
    add(
      'leverage',
      'Deuda / patrimonio',
      v.TotalDebt / v.StockholdersEquity,
      '×',
      'Deuda total por cada unidad de patrimonio contable.',
    );
  add(
    'eps',
    'Ganancia por acción',
    v.DilutedEPS,
    latest.currency + '/acción',
    'Resultado diluido anual por acción del emisor, sin conversión por ratio de CEDEAR.',
  );
  return result;
}
export async function publicFundamentals(
  requested: Instrument,
  issuer: Instrument,
): Promise<FundamentalResearch> {
  return cached('public-research:v2:' + requested.id, 900000, async () => {
    const comparison = earningsComparison(issuer);
    const result: FundamentalResearch = {
      instrumentId: requested.id,
      issuer: issuer.name,
      kind: issuer.type,
      source: 'Ficha del instrumento',
      url: '',
      asOf: null,
      retrievedAt: new Date().toISOString(),
      periods: [],
      metrics: [],
      title: 'Perfil fundamental',
      conclusion: issuer.name + ' · ' + issuer.sector + ' · ' + issuer.country,
      coverage: [],
    };
    try {
      if (issuer.type === 'crypto') {
        const base = issuer.symbol.replace(/USDT$/, '').toLowerCase();
        const coin =
          issuer.exchange === 'COINGECKO'
            ? issuer.providerSymbol
            : cryptoCatalog.entries.find((entry) => entry[1].toLowerCase() === base)?.[0];
        if (!coin)
          throw new Error(
            'No se identificó el token de forma inequívoca en la fuente fundamental.',
          );
        const url =
          'https://api.coingecko.com/api/v3/coins/' +
          encodeURIComponent(coin) +
          '?localization=false&tickers=false&community_data=false&developer_data=false';
        const coinSchema = z.object({
          id: z.literal(coin),
          symbol: z.string(),
          last_updated: z.iso.datetime(),
          market_data: z.object({
            market_cap: z.object({ usd: z.number().nonnegative().nullable() }),
            total_volume: z.object({ usd: z.number().nonnegative().nullable() }),
            fully_diluted_valuation: z.object({ usd: z.number().nonnegative().nullable() }),
            circulating_supply: z.number().nonnegative().nullable(),
            max_supply: z.number().nonnegative().nullable(),
          }),
        });
        const c = coinSchema.parse(await fetchJson(url));
        if (c.symbol.toLowerCase() !== base)
          throw new Error('El token devuelto no coincide con el solicitado.');
        const m = c.market_data;
        result.source = 'CoinGecko · fundamentos de criptoactivos';
        result.url = 'https://www.coingecko.com/en/coins/' + encodeURIComponent(coin);
        result.asOf = c.last_updated;
        const add = (
          id: string,
          label: string,
          value: number | null,
          unit: string,
          explanation: string,
        ) => {
          if (value !== null) result.metrics.push({ id, label, value, unit, explanation });
        };
        add(
          'marketCap',
          'Capitalización circulante',
          m.market_cap.usd,
          'USD',
          'Precio agregado por oferta circulante. Mide el tamaño económico del token.',
        );
        add(
          'volume',
          'Volumen agregado 24 h',
          m.total_volume.usd,
          'USD',
          'Actividad de negociación agregada entre los mercados seguidos por CoinGecko.',
        );
        add(
          'fdv',
          'Valuación diluida',
          m.fully_diluted_valuation.usd,
          'USD',
          'Valor de la oferta diluida según la metodología de la fuente.',
        );
        add(
          'supply',
          'Oferta circulante',
          m.circulating_supply,
          base.toUpperCase(),
          'Unidades actualmente en circulación.',
        );
        add(
          'maxSupply',
          'Oferta máxima',
          m.max_supply,
          base.toUpperCase(),
          'Límite de emisión reportado por la fuente.',
        );
        if (m.max_supply && m.circulating_supply !== null)
          add(
            'issued',
            'Oferta emitida',
            (m.circulating_supply / m.max_supply) * 100,
            '%',
            'Porcentaje de la oferta máxima que ya circula; el resto representa emisión potencial.',
          );
        result.title = 'Tamaño, liquidez y oferta';
        result.conclusion =
          'El análisis fundamental de este token se apoya en capitalización, actividad de mercado y emisión. La relación entre oferta circulante y máxima describe la dilución potencial.';
        result.coverage.push(
          'Las criptomonedas no tienen estados corporativos ni ganancia por acción. Estas métricas no miden ingresos del protocolo, adopción ni concentración de tenedores.',
        );
      } else if (issuer.type === 'stock') {
        const symbol = yahooSymbol(issuer);
        const types = financialConcepts.map(([id]) => 'annual' + id).join(',');
        const url =
          'https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/' +
          encodeURIComponent(symbol) +
          '?type=' +
          types +
          '&period1=' +
          Math.floor(Date.now() / 1000 - 6 * 366 * 86400) +
          '&period2=' +
          Math.floor(Date.now() / 1000);
        result.periods = parsePublicPeriods(await fetchJson(url), symbol);
        result.metrics = corporateMetrics(result.periods);
        result.source = 'Yahoo Finance · estados anuales reportados';
        result.url =
          'https://finance.yahoo.com/quote/' + encodeURIComponent(symbol) + '/financials/';
        result.asOf = result.periods[0]?.date ?? null;
        const v = result.periods[0]?.values;
        if (v) {
          result.title =
            v.NetIncome == null
              ? 'Actividad y estructura financiera'
              : v.NetIncome > 0
                ? 'Negocio con resultado positivo'
                : v.NetIncome < 0
                  ? 'Negocio con pérdidas'
                  : 'Resultado en equilibrio';
          result.conclusion =
            v.NetIncome == null
              ? 'La fuente permite analizar las partidas disponibles del ejercicio.'
              : v.NetIncome > 0
                ? 'El último ejercicio cerró con ganancias contables.'
                : v.NetIncome < 0
                  ? 'El último ejercicio cerró con pérdidas contables.'
                  : 'El último ejercicio cerró sin ganancia ni pérdida neta.';
          if (v.OperatingCashFlow != null)
            result.conclusion +=
              v.OperatingCashFlow > 0
                ? ' La operación generó efectivo.'
                : ' La operación consumió efectivo.';
          const growth = result.metrics.find((m) => m.id === 'growth');
          if (growth)
            result.conclusion +=
              growth.value >= 0
                ? ' Los ingresos crecieron frente al ejercicio anterior.'
                : ' Los ingresos disminuyeron frente al ejercicio anterior.';
        } else throw new Error('La fuente no publicó partidas anuales para este emisor.');
        result.coverage.push(
          'Ejercicios fiscales anuales; no TTM. Las partidas ausentes quedan vacías. Los indicadores comparan únicamente períodos de la misma moneda.',
        );
        if (requested.type === 'cedear')
          result.coverage.push(
            'Se analiza el emisor subyacente. Las cifras y la ganancia por acción no se convierten al precio ni al ratio del certificado.',
          );
      } else {
        const symbol = yahooSymbol(issuer);
        const chart = z
          .object({
            chart: z.object({
              result: z
                .array(
                  z.object({
                    meta: z.object({
                      symbol: z.string(),
                      currency: z.string(),
                      regularMarketTime: z.number(),
                      regularMarketVolume: z.number().nonnegative().optional(),
                    }),
                  }),
                )
                .nullable(),
            }),
          })
          .parse(
            await fetchJson(
              'https://query1.finance.yahoo.com/v8/finance/chart/' +
                encodeURIComponent(symbol) +
                '?range=1d&interval=1d',
            ),
          );
        const meta = chart.chart.result?.[0]?.meta;
        if (
          !meta ||
          meta.symbol.toUpperCase() !== symbol.toUpperCase() ||
          meta.currency !== issuer.currency
        )
          throw new Error('La fuente no confirmó el fondo solicitado.');
        result.source = 'Yahoo Finance · ficha pública del fondo';
        result.url = 'https://finance.yahoo.com/quote/' + encodeURIComponent(symbol) + '/';
        result.asOf = new Date(meta.regularMarketTime * 1000).toISOString();
        if (meta.regularMarketVolume != null)
          result.metrics.push({
            id: 'volume',
            label: 'Volumen de la sesión',
            value: meta.regularMarketVolume,
            unit: 'cuotas',
            explanation:
              'Cuotas negociadas en la sesión indicada; describe actividad, no patrimonio administrado.',
          });
        result.title = 'Exposición y estructura del fondo';
        result.conclusion =
          issuer.name +
          '. Un fondo se analiza por su exposición, concentración, costos y mecanismo de réplica; el beneficio neto de una empresa no describe su calidad.';
        result.coverage.push(
          'La fuente pública confirma identidad y actividad. Composición, patrimonio, comisión y tracking error requieren el informe del administrador: no se estiman a partir del precio.',
        );
      }
    } catch (e) {
      result.error = e instanceof Error ? e.message : 'No se pudo consultar la fuente fundamental.';
      result.coverage.push(result.error);
    }
    result.earnings = await comparison;
    return result;
  });
}
