import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { SecProvider, resolveSecCik } from '@/lib/market/sec';
import { instruments } from '@/lib/market/catalog';
import { assetFinancialStatements } from '@/lib/market/service';
import { secBundleFixture, secDirectoryFixture, secFixture } from '../fixtures/sec';
vi.mock('@/lib/security', () => ({ rateLimit: vi.fn() }));
const apple = instruments.find((i) => i.symbol === 'AAPL' && i.exchange === 'NASDAQ')!;
const temporaryFolders: string[] = [];
afterEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  for (const folder of temporaryFolders.splice(0))
    await rm(folder, { recursive: true, force: true });
});
describe('SEC provider boundaries', () => {
  it('requires an identified contact rather than sending anonymous requests', async () => {
    vi.stubEnv('SEC_USER_AGENT', '');
    vi.stubEnv('SEC_COMPANYFACTS_FILE', '');
    await expect(new SecProvider().statements(apple)).rejects.toThrow('SEC_USER_AGENT');
    vi.stubEnv('SEC_USER_AGENT', 'Cuantai');
    await expect(new SecProvider().statements(apple)).rejects.toThrow('contacto real');
  });
  it('matches ticker and exchange together, including dot/hyphen share classes', () => {
    expect(resolveSecCik(secDirectoryFixture, apple)).toBe(123456);
    expect(() => resolveSecCik(secDirectoryFixture, { ...apple, exchange: 'NYSE' })).toThrow(
      'inequívoca',
    );
    expect(
      resolveSecCik(
        { ...secDirectoryFixture, data: [[1067983, 'Test', 'BRK-B', 'NYSE']] },
        { ...apple, symbol: 'BRK.B', exchange: 'NYSE' },
      ),
    ).toBe(1067983);
    expect(() =>
      resolveSecCik(
        {
          ...secDirectoryFixture,
          data: [...secDirectoryFixture.data, [999, 'Other', 'AAPL', 'Nasdaq']],
        },
        apple,
      ),
    ).toThrow('inequívoca');
  });
  it('retrieves a matching CIK server-side with an identified User-Agent', async () => {
    vi.stubEnv('SEC_USER_AGENT', 'Cuantai unit test qa@example.test');
    vi.stubEnv('SEC_COMPANYFACTS_FILE', '');
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(secDirectoryFixture)))
      .mockResolvedValueOnce(new Response(JSON.stringify(secFixture())));
    vi.stubGlobal('fetch', fetch);
    const result = await new SecProvider().statements(apple);
    expect(result.delivery).toBe('sec-api');
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1][0]).toBe(
      'https://data.sec.gov/api/xbrl/companyfacts/CIK0000123456.json',
    );
    expect(fetch.mock.calls[1][1].headers['User-Agent']).toContain('qa@example.test');
  });
  it('reads validated offline facts and retains their original retrieval timestamp', async () => {
    const folder = await mkdtemp(path.join(os.tmpdir(), 'cuantai-sec-'));
    temporaryFolders.push(folder);
    const file = path.join(folder, 'facts.json');
    await writeFile(file, JSON.stringify(secBundleFixture()));
    vi.stubEnv('SEC_COMPANYFACTS_FILE', file);
    vi.stubEnv('SEC_USER_AGENT', '');
    const result = await new SecProvider().statements(apple);
    expect(result.retrievedAt).toBe('2026-10-16T00:00:00Z');
    expect(result.delivery).toBe('imported-snapshot');
    expect(result.periods).toHaveLength(3);
  });
  it('never substitutes synthetic financials for demo or unavailable providers', async () => {
    vi.stubEnv('MARKET_DATA_MODE', 'demo');
    expect(await assetFinancialStatements(apple)).toMatchObject({ data: null, reason: 'DEMO' });
    vi.stubEnv('MARKET_DATA_MODE', 'live');
    vi.stubEnv('SEC_USER_AGENT', '');
    vi.stubEnv('SEC_COMPANYFACTS_FILE', '');
    expect(await assetFinancialStatements(apple)).toMatchObject({
      data: null,
      reason: 'UNAVAILABLE',
    });
    expect(
      await assetFinancialStatements(instruments.find((i) => i.type === 'crypto')!),
    ).toMatchObject({ data: null, reason: 'NOT_APPLICABLE' });
  });
  it('resolves a CEDEAR to its issuer without treating ARS or ratios as statement units', async () => {
    const folder = await mkdtemp(path.join(os.tmpdir(), 'cuantai-sec-'));
    temporaryFolders.push(folder);
    const file = path.join(folder, 'facts.json');
    await writeFile(file, JSON.stringify(secBundleFixture()));
    vi.stubEnv('SEC_COMPANYFACTS_FILE', file);
    vi.stubEnv('MARKET_DATA_MODE', 'live');
    const result = await assetFinancialStatements(
      instruments.find((i) => i.id === 'BYMA:AAPL:ARS')!,
    );
    expect(result.data).toMatchObject({
      requestedInstrumentId: 'BYMA:AAPL:ARS',
      issuerInstrumentId: apple.id,
    });
    expect(result.data?.rows.every((row) => row.unit === 'USD' || row.unit === 'USD/shares')).toBe(
      true,
    );
  });
});
