import { canonicalRow, normalize } from './fields';
export { canonicalRow } from './fields';
import Decimal from 'decimal.js';
import { z } from 'zod';
import { discoverInstruments, findDiscoveryInstrument } from '../market/discovery';
import { findInstrument } from '../market/catalog';
import type { Instrument, Currency } from '../market/types';
import type { Transaction } from '../finance/portfolio';
export const importInputSchema = z
  .object({
    portfolioId: z.string().min(1),
    mode: z.enum(['trades', 'holdings']),
    source: z.string().max(100).default('Archivo'),
    numberFormat: z.enum(['es', 'en']).default('es'),
    market: z.enum(['auto', 'US', 'AR', 'cedear', 'crypto']).default('auto'),
    rows: z.array(z.record(z.string().max(80), z.string().max(2000))).max(500),
    sourceKey: z.string().max(200).optional(),
    completeSnapshot: z.boolean().default(false),
  })
  .refine(
    (input) =>
      input.rows.length > 0 ||
      (input.mode === 'holdings' &&
        input.completeSnapshot &&
        input.sourceKey?.startsWith('wallet:')),
    'La importación no contiene filas',
  );
export type ImportInput = z.infer<typeof importInputSchema>;
export type DraftRow = {
  id: string;
  raw: Record<string, string>;
  instrument?: Instrument;
  candidates: Instrument[];
  transaction?: Omit<Transaction, 'id'>;
  targetQuantity?: string;
  importKey?: string;
  duplicate: boolean;
  errors: string[];
  warnings: string[];
};
export function importDecimal(value: string, format: 'es' | 'en') {
  let text = value
    .trim()
    .replace(/\s|[$€]/g, '')
    .replace(/^(ARS|USD|USDT)\s*/i, '');
  if (!text) throw new Error('Falta un valor numérico');
  if (text.includes(',') && text.includes('.')) {
    const grouping =
      text.lastIndexOf(',') > text.lastIndexOf('.')
        ? /^-?\d{1,3}(\.\d{3})+,\d+$/
        : /^-?\d{1,3}(,\d{3})+\.\d+$/;
    if (!grouping.test(text)) throw new Error('Separadores numéricos inconsistentes');
    text =
      text.lastIndexOf(',') > text.lastIndexOf('.')
        ? text.replace(/\./g, '').replace(',', '.')
        : text.replace(/,/g, '');
  } else if (text.includes(',')) {
    if (format === 'en' && !/^-?\d{1,3}(,\d{3})+$/.test(text))
      throw new Error('Separadores numéricos inconsistentes');
    text = format === 'es' ? text.replace(',', '.') : text.replace(/,/g, '');
  } else if (format === 'es' && /^\d{1,3}(\.\d{3})+$/.test(text)) text = text.replace(/\./g, '');
  if (!/^-?\d+(\.\d+)?$/.test(text) || text.length > 44) throw new Error('Número no reconocido');
  const number = new Decimal(text);
  if (number.abs().gte('1e20') || number.decimalPlaces() > 18)
    throw new Error('Número fuera de rango');
  return number.toFixed();
}
function importDate(value: string, format: 'es' | 'en') {
  if (!value) throw new Error('Falta la fecha');
  let date = value.slice(0, 10);
  const match = date.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  if (match) {
    const [, a, b, y] = match;
    date = `${y}-${(format === 'es' ? b : a).padStart(2, '0')}-${(format === 'es' ? a : b).padStart(2, '0')}`;
  }
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== date ||
    date > new Date().toISOString().slice(0, 10)
  )
    throw new Error('Fecha inválida o futura');
  return date;
}
export function buildImportRows(
  input: ImportInput,
  extraInstruments: Instrument[] = [],
): DraftRow[] {
  const seenHoldings = new Set<string>();
  return input.rows.map((raw, index) => {
    const row = canonicalRow(raw);
    const result: DraftRow = {
      id: String(index),
      raw,
      candidates: [],
      duplicate: false,
      errors: [],
      warnings: [],
    };
    let candidates: Instrument[] = [];
    if (row.instrumentId) {
      const exact =
        findDiscoveryInstrument(row.instrumentId) ??
        findInstrument(row.instrumentId) ??
        extraInstruments.find((i) => i.id === row.instrumentId);
      if (exact) candidates = [exact];
    } else if (row.symbol) {
      const symbol = row.symbol.toUpperCase().replace(/\.BA$/, '');
      candidates = discoverInstruments({ query: symbol, pageSize: 100 }).instruments.filter(
        (i) => i.symbol.toUpperCase() === symbol,
      );
      const cash = findInstrument(`CASH:${symbol}:${symbol}`);
      if (cash) candidates.push(cash);
      if (row.exchange) {
        const exchange = row.exchange.toUpperCase().replace('BCBA', 'BYMA');
        candidates = candidates.filter((i) => i.exchange === exchange);
      }
      if (row.currency)
        candidates = candidates.filter((i) => i.currency === row.currency.toUpperCase());
      if (input.market === 'US')
        candidates = candidates.filter((i) => i.country === 'US' && i.exchange !== 'BYMA');
      if (input.market === 'AR')
        candidates = candidates.filter((i) => i.type === 'stock' && i.exchange === 'BYMA');
      if (input.market === 'cedear') candidates = candidates.filter((i) => i.type === 'cedear');
      if (input.market === 'crypto') candidates = candidates.filter((i) => i.type === 'crypto');
    }
    result.candidates = candidates;
    if (candidates.length !== 1) {
      result.errors.push(
        candidates.length
          ? 'Elegí la especie exacta: el ticker existe en más de un mercado.'
          : 'No se encontró el activo. Seleccioná una especie del catálogo.',
      );
      return result;
    }
    const instrument = candidates[0];
    result.instrument = instrument;
    try {
      const quantity = importDecimal(row.quantity ?? '', input.numberFormat);
      if (
        new Decimal(quantity).lt(0) ||
        (input.mode === 'trades' && new Decimal(quantity).isZero())
      )
        throw new Error('La cantidad debe ser positiva');
      if (input.mode === 'holdings' && seenHoldings.has(instrument.id))
        throw new Error('El saldo del mismo activo aparece más de una vez');
      seenHoldings.add(instrument.id);
      const typeKey = normalize(row.type ?? '');
      const type: Transaction['type'] | null =
        input.mode === 'holdings'
          ? 'TRANSFER_IN'
          : ['buy', 'compra', 'comprar', 'c', 'purchase'].includes(typeKey)
            ? 'BUY'
            : ['sell', 'venta', 'venda', 'vender', 'v'].includes(typeKey)
              ? 'SELL'
              : ['dividend', 'dividendo', 'dividendos'].includes(typeKey)
                ? 'DIVIDEND'
                : ['deposit', 'deposito', 'ingreso'].includes(typeKey)
                  ? 'DEPOSIT'
                  : ['withdrawal', 'retiro', 'retirada'].includes(typeKey)
                    ? 'WITHDRAWAL'
                    : null;
      if (!type) throw new Error('Falta el tipo de operación: compra o venta');
      const price =
        instrument.type === 'cash'
          ? '1'
          : row.price
            ? importDecimal(row.price, input.numberFormat)
            : input.mode === 'holdings'
              ? '0'
              : null;
      if (price === null) throw new Error('Falta el precio unitario de la operación');
      if (new Decimal(price).lt(0)) throw new Error('El precio no puede ser negativo');
      const fees = importDecimal(row.fees || '0', input.numberFormat);
      if (new Decimal(fees).lt(0)) throw new Error('Las comisiones no pueden ser negativas');
      const date = importDate(row.date ?? '', input.numberFormat);
      const currency = (row.currency?.toUpperCase() ?? instrument.currency) as Currency;
      if (currency !== instrument.currency)
        throw new Error('La moneda no coincide con la especie seleccionada');
      if (
        input.mode === 'trades' &&
        ['DEPOSIT', 'WITHDRAWAL'].includes(type) !== (instrument.type === 'cash')
      )
        throw new Error('Depósitos y retiros son solo de efectivo');
      const fxRate = row.fxRate ? importDecimal(row.fxRate, input.numberFormat) : null;
      if (fxRate && new Decimal(fxRate).lte(0))
        throw new Error('El tipo de cambio debe ser positivo');
      result.transaction = {
        instrumentId: instrument.id,
        type,
        quantity,
        price,
        fees,
        currency,
        date,
        fxRate,
        fxKind: fxRate ? 'manual' : null,
        fxSource: fxRate ? 'Archivo importado' : null,
        broker: row.broker?.slice(0, 80) ?? null,
        notes: `Importado: ${input.source}`,
      };
      if (input.mode === 'holdings') {
        result.targetQuantity = quantity;
        result.transaction.costBasisUnknown = !row.price;
        result.warnings.push(
          'Saldo a la fecha indicada. Se registrará un ajuste de tenencia, no una compra o venta.',
        );
        if (!row.price)
          result.warnings.push(
            'Sin costo de adquisición: el resultado y el costo permanecerán sin determinar.',
          );
      }
      if (!row.fees) result.warnings.push('No se informaron comisiones; revisá el valor cero.');
      if (!row.currency)
        result.warnings.push(`Moneda tomada de la especie: ${instrument.currency}`);
    } catch (e) {
      result.errors.push((e as Error).message);
    }
    return result;
  });
}
