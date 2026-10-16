import { describe, expect, it } from 'vitest';
import { transactionSchema, settingsSchema, workspaceSchema } from '@/lib/validation';
import { assertOrigin, readJson } from '@/lib/security';
describe('server input validation', () => {
  const transaction = {
    portfolioId: 'p',
    instrumentId: 'BYMA:JPM:ARS',
    type: 'BUY',
    quantity: '174',
    price: '10000',
    fees: '0',
    currency: 'ARS',
    date: '2025-01-01',
  };
  it('requires FX provenance when a historical rate is supplied', () => {
    expect(transactionSchema.safeParse({ ...transaction, fxRate: '0.001' }).success).toBe(false);
    expect(
      transactionSchema.safeParse({
        ...transaction,
        fxRate: '0.001',
        fxKind: 'MEP',
        fxSource: 'Broker statement',
      }).success,
    ).toBe(true);
  });
  it('rejects negatives, nonfinite values, future dates and zero quantities', () => {
    for (const quantity of ['0', '-1', 'NaN', 'Infinity', '1e100'])
      expect(transactionSchema.safeParse({ ...transaction, quantity }).success).toBe(false);
    expect(transactionSchema.safeParse({ ...transaction, date: '2099-01-01' }).success).toBe(false);
  });
  it('requires zero price and fees for a split factor', () => {
    const split = { ...transaction, type: 'SPLIT', quantity: '2', price: '0', fees: '0' };
    expect(transactionSchema.safeParse(split).success).toBe(true);
    expect(transactionSchema.safeParse({ ...split, price: '1' }).success).toBe(false);
    expect(transactionSchema.safeParse({ ...split, fees: '0.01' }).success).toBe(false);
  });
  it('rejects unknown timezones', () => {
    expect(
      settingsSchema.safeParse({
        country: 'AR',
        currency: 'USD',
        experience: 'beginner',
        language: 'es',
        theme: 'dark',
        timezone: 'No/Such_Zone',
        interests: [],
        onboarded: true,
      }).success,
    ).toBe(false);
  });
  it('rejects oversized graph layouts', () => {
    expect(
      workspaceSchema.safeParse({ name: 'x', config: { instrumentIds: Array(5).fill('x') } })
        .success,
    ).toBe(false);
  });
  it('requires the configured origin and JSON on mutation', () => {
    const origin = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000';
    expect(() =>
      assertOrigin(
        new Request(`${origin}/api/data/watchlists`, {
          method: 'POST',
          headers: { origin: 'https://attacker.example', 'content-type': 'application/json' },
        }),
      ),
    ).toThrow('origin');
    expect(() =>
      assertOrigin(
        new Request(`${origin}/api/data/watchlists`, { method: 'POST', headers: { origin } }),
      ),
    ).toThrow('JSON');
  });
  it('rejects malformed and oversized JSON', async () => {
    await expect(
      readJson(new Request('https://example.com', { method: 'POST', body: '{' })),
    ).rejects.toThrow('JSON');
    await expect(
      readJson(
        new Request('https://example.com', {
          method: 'POST',
          body: JSON.stringify({ x: 'a'.repeat(65000) }),
        }),
      ),
    ).rejects.toThrow('large');
  });
});
