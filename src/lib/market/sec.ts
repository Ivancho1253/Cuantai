import { readFile, stat } from 'node:fs/promises';
import { z } from 'zod';
import { rateLimit } from '../security';
import {
  companyFactsSchema,
  companyFactsUrl,
  normalizeStatements,
  type FinancialStatements,
  type FinancialStatementsProvider,
} from '../finance/statements';
import { cached, fetchJson } from './transport';
import { ProviderError, type Instrument } from './types';

const tickerDirectorySchema = z.object({
  fields: z.array(z.string()),
  data: z.array(z.array(z.union([z.string(), z.number(), z.null()]))),
});
export const secSnapshotSchema = z.object({
  retrievedAt: z.iso
    .datetime()
    .refine((v) => Date.parse(v) <= Date.now() + 60000, 'Future retrieval date'),
  companyTickers: tickerDirectorySchema,
  companyFacts: z.array(companyFactsSchema).min(1).max(100),
});
export const SEC_TICKERS_URL = 'https://www.sec.gov/files/company_tickers_exchange.json';
const canonicalSymbol = (symbol: string) => symbol.toUpperCase().replaceAll('.', '-');

export function resolveSecCik(input: unknown, instrument: Instrument): number {
  const directory = tickerDirectorySchema.parse(input);
  const cikIndex = directory.fields.indexOf('cik');
  const tickerIndex = directory.fields.indexOf('ticker');
  const exchangeIndex = directory.fields.indexOf('exchange');
  if ([cikIndex, tickerIndex, exchangeIndex].some((index) => index < 0))
    throw new ProviderError('El directorio SEC no contiene CIK, ticker y exchange.');
  const matches = directory.data.filter(
    (row) =>
      typeof row[tickerIndex] === 'string' &&
      canonicalSymbol(row[tickerIndex] as string) === canonicalSymbol(instrument.symbol) &&
      typeof row[exchangeIndex] === 'string' &&
      (row[exchangeIndex] as string).toUpperCase() === instrument.exchange.toUpperCase(),
  );
  const ciks = [...new Set(matches.map((row) => row[cikIndex]))];
  if (ciks.length !== 1 || !z.number().int().positive().max(9999999999).safeParse(ciks[0]).success)
    throw new ProviderError('No hay una asociación SEC inequívoca para este ticker y mercado.');
  return ciks[0] as number;
}

export class SecProvider implements FinancialStatementsProvider {
  async statements(instrument: Instrument): Promise<FinancialStatements> {
    if (
      instrument.type !== 'stock' ||
      instrument.country !== 'US' ||
      !['NYSE', 'NASDAQ'].includes(instrument.exchange)
    )
      throw new ProviderError(
        'SEC US-GAAP anual no es aplicable a este instrumento.',
        'NOT_APPLICABLE',
      );
    const snapshotFile = process.env.SEC_COMPANYFACTS_FILE;
    const userAgent = process.env.SEC_USER_AGENT?.trim();
    if (
      !snapshotFile &&
      (!userAgent || !/[^\s@]+@[^\s@]+\.[^\s@]+/.test(userAgent) || /[\r\n]/.test(userAgent))
    )
      throw new ProviderError(
        'Configurá SEC_USER_AGENT con el nombre de la aplicación y un email de contacto real, o importá un archivo SEC_COMPANYFACTS_FILE.',
        'CREDENTIALS',
      );
    const key = `sec:statements:${instrument.id}:${instrument.sector}:${snapshotFile ?? userAgent}`;
    return cached(key, snapshotFile ? 60000 : 21600000, async () => {
      let facts: unknown;
      let retrievedAt: string;
      let delivery: FinancialStatements['delivery'];
      let cik: number;
      if (snapshotFile) {
        if ((await stat(snapshotFile)).size > 25000000)
          throw new ProviderError('El archivo SEC supera el límite de 25 MB.');
        const bundle = secSnapshotSchema.parse(JSON.parse(await readFile(snapshotFile, 'utf8')));
        cik = resolveSecCik(bundle.companyTickers, instrument);
        const matches = bundle.companyFacts.filter((f) => f.cik === cik);
        if (matches.length !== 1)
          throw new ProviderError(
            'El archivo SEC debe contener un único Company Facts para el CIK seleccionado.',
          );
        facts = matches[0];
        retrievedAt = bundle.retrievedAt;
        delivery = 'imported-snapshot';
      } else {
        const directory = await cached('sec:ticker-directory', 86400000, () =>
          this.get(SEC_TICKERS_URL, userAgent!),
        );
        cik = resolveSecCik(directory, instrument);
        facts = await this.get(companyFactsUrl(cik), userAgent!);
        if (companyFactsSchema.parse(facts).cik !== cik)
          throw new ProviderError('El CIK de Company Facts no coincide con el directorio SEC.');
        retrievedAt = new Date().toISOString();
        delivery = 'sec-api';
      }
      const result = normalizeStatements(facts, {
        instrumentId: instrument.id,
        retrievedAt,
        financialSector: /financial|bank|insurance/i.test(instrument.sector),
        sectorKnown:
          Boolean(instrument.sector.trim()) &&
          !/^(unknown|unclassified)$/i.test(instrument.sector.trim()),
        delivery,
      });
      if (!result.periods.length)
        throw new ProviderError(
          'No hay ejercicios anuales US-GAAP compatibles en las presentaciones 10-K disponibles. No se infieren cifras IFRS o de etiquetas propias.',
        );
      return result;
    });
  }
  private async get(url: string, userAgent: string) {
    // Count every HTTP attempt, including retries, against the shared SEC access budget.
    return fetchJson(url, { 'User-Agent': userAgent, Accept: 'application/json' }, () =>
      rateLimit('provider:sec', 2, 1),
    );
  }
}
