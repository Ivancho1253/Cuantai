import { z } from 'zod';
import { currencies, timeframes } from './market/types';
const money = z
  .string()
  .regex(/^\d{1,16}(\.\d{1,12})?$/, 'Usá un número positivo con punto decimal');
const positive = money.refine((v) => Number(v) > 0, 'Debe ser mayor que cero');
export const transactionSchema = z
  .object({
    portfolioId: z.string().min(1),
    instrumentId: z.string().min(1),
    type: z.enum(['BUY', 'SELL', 'DIVIDEND', 'DEPOSIT', 'WITHDRAWAL', 'SPLIT']),
    quantity: positive,
    price: money,
    fees: money.default('0'),
    currency: z.enum(currencies),
    date: z.iso
      .date()
      .refine(
        (v) => v <= new Date().toISOString().slice(0, 10),
        'La fecha no puede estar en el futuro',
      ),
    fxRate: positive.nullable().default(null),
    fxKind: z.enum(['MEP', 'CCL', 'official', 'spot', 'manual']).nullable().default(null),
    fxSource: z.string().max(200).nullable().default(null),
    broker: z.string().max(80).nullable().default(null),
    notes: z.string().max(1000).nullable().default(null),
  })
  .refine(
    (t) => t.type !== 'SPLIT' || (Number(t.price) === 0 && Number(t.fees) === 0),
    'En un split, el precio y las comisiones deben ser cero',
  )
  .refine(
    (t) => !t.fxRate || Boolean(t.fxKind && t.fxSource),
    'Indicá tipo y fuente del cambio histórico',
  );
export const settingsSchema = z.object({
  country: z.enum(['AR', 'US', 'other']),
  currency: z.enum(currencies),
  experience: z.enum(['beginner', 'intermediate', 'advanced']),
  language: z.enum(['es', 'en']),
  theme: z.enum(['dark', 'light', 'system']),
  timezone: z
    .string()
    .max(80)
    .refine((v) => {
      try {
        new Intl.DateTimeFormat('en', { timeZone: v });
        return true;
      } catch {
        return false;
      }
    }, 'Zona horaria inválida'),
  interests: z.array(z.enum(['stocks', 'crypto', 'argentina', 'etfs'])).max(4),
  horizon: z.string().max(60).optional(),
  risk: z.enum(['conservative', 'moderate', 'aggressive']).optional(),
  onboarded: z.boolean(),
});
export const workspaceSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(80),
  config: z
    .object({
      instrumentIds: z.array(z.string()).min(1).max(4),
      timeframe: z.enum(timeframes),
      chartType: z.enum(['candles', 'line', 'area', 'bars']),
      logarithmic: z.boolean(),
      indicators: z
        .array(
          z.object({
            id: z.string(),
            kind: z.enum(['EMA', 'SMA', 'RSI', 'MACD', 'BB', 'ATR', 'OBV', 'VWAP']),
            period: z.number().int().min(1).max(2000),
            color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
            visible: z.boolean(),
          }),
        )
        .max(50),
      drawings: z
        .array(
          z.object({
            id: z.string(),
            instrumentId: z.string(),
            price: z.number().positive(),
            label: z.string().max(80),
            color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
          }),
        )
        .max(100),
    })
    .strict()
    .or(
      z
        .object({
          provider: z.literal('tradingview'),
          instrumentIds: z.array(z.string().min(1)).min(1).max(4),
          timeframe: z.enum(timeframes),
          chartType: z.enum(['candles', 'line', 'area', 'bars']),
        })
        .strict(),
    ),
});
export const quoteInputSchema = z.object({
  instrumentId: z.string(),
  price: positive,
  asOf: z.iso.datetime().refine((v) => new Date(v).getTime() <= Date.now() + 60000),
  source: z.string().min(3).max(200),
});
export const fxInputSchema = z
  .object({
    from: z.enum(currencies),
    to: z.enum(currencies),
    rate: positive,
    asOf: z.iso.datetime().refine((v) => new Date(v).getTime() <= Date.now() + 60000),
    source: z.string().min(3).max(200),
    kind: z.enum(['MEP', 'CCL', 'official', 'spot', 'manual']),
  })
  .refine((v) => v.from !== v.to, 'Seleccioná monedas diferentes');
