import { describe, expect, it } from 'vitest';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { instruments } from '@/lib/market/catalog';
import { assetLogo, CRYPTO_LOGO_REVISION } from '@/lib/market/logos';
const listing = (id: string) => instruments.find((instrument) => instrument.id === id)!;
describe('Issuer logos and asset identity', () => {
  it('covers the whole shipped catalog with existing local images', async () => {
    const files = new Set<string>();
    for (const instrument of instruments) {
      const logo = assetLogo(instrument);
      expect(logo, instrument.id).not.toBeNull();
      expect(logo!.src, instrument.id).toMatch(/^\/asset-logos\//);
      await access(path.join(process.cwd(), 'public', logo!.src));
      files.add(logo!.src);
    }
    for (const file of files) {
      const data = await readFile(path.join(process.cwd(), 'public', file));
      if (file.endsWith('.png'))
        expect(data.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      else {
        expect(data.toString()).toContain('<svg');
        expect(data.toString()).not.toMatch(/<script|<foreignObject|<image|onload=/i);
      }
    }
  });
  it('uses the same issuer for both certificate currencies and never guesses an underlying from a D suffix', () => {
    expect(assetLogo(listing('BYMA:JPM:ARS'))?.src).toBe(assetLogo(listing('NYSE:JPM:USD'))?.src);
    expect(assetLogo(listing('BYMA:JPMD:USD'))?.src).toBe(assetLogo(listing('NYSE:JPM:USD'))?.src);
    expect(assetLogo(listing('BYMA:AAPLD:USD'))?.src).toBe(
      assetLogo(listing('NASDAQ:AAPL:USD'))?.src,
    );
    expect(assetLogo({ ...listing('BYMA:JPMD:USD'), underlyingId: undefined })).toBeNull();
    expect(assetLogo({ ...listing('BYMA:JPMD:USD'), underlyingId: 'NASDAQ:MSFT:USD' })?.src).toBe(
      assetLogo(listing('NASDAQ:MSFT:USD'))?.src,
    );
  });
  it('bounds external discovery to supported venues and a safe, pinned asset identifier', () => {
    expect(
      assetLogo({ ...listing('NASDAQ:NVDA:USD'), id: 'NASDAQ:AMD:USD', symbol: 'AMD' })?.src,
    ).toBe('https://images.financialmodelingprep.com/symbol/AMD.png');
    expect(
      assetLogo({ ...listing('BYMA:GGAL:ARS'), id: 'BYMA:YPFD:ARS', symbol: 'YPFD' })?.src,
    ).toBe('https://images.financialmodelingprep.com/symbol/YPFD.BA.png');
    expect(
      assetLogo({
        ...listing('BINANCE:BTCUSDT:USDT'),
        id: 'BINANCE:ADAUSDT:USDT',
        symbol: 'ADAUSDT',
      })?.src,
    ).toContain(`@${CRYPTO_LOGO_REVISION}/svg/color/ada.svg`);
    expect(
      assetLogo({
        ...listing('NASDAQ:NVDA:USD'),
        id: 'UNVERIFIED:AMD:USD',
        exchange: 'UNVERIFIED',
        symbol: 'AMD',
      }),
    ).toBeNull();
    expect(
      assetLogo({
        ...listing('NASDAQ:NVDA:USD'),
        id: 'NASDAQ:../../private:USD',
        symbol: '../../private',
      }),
    ).toBeNull();
  });
});
