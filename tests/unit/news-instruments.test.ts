import { describe, expect, it, vi } from 'vitest';
import { newsInstruments } from '@/lib/market/news-instruments';
import { instruments } from '@/lib/market/catalog';
const get = (id: string) => instruments.find((i) => i.id === id)!;
describe('issuer-focused news discovery', () => {
  it('combines US shares and both certificate currencies into one news subject', async () => {
    const stock = get('NASDAQ:AAPL:USD');
    const result = await newsInstruments(
      [get('BYMA:AAPL:ARS'), get('BYMA:AAPLD:USD'), stock],
      async () => stock,
    );
    expect(result).toEqual([stock]);
  });
  it('resolves the company even when only a certificate ticker matches the search', async () => {
    const stock = get('NYSE:JPM:USD'),
      resolve = vi.fn(async () => stock);
    expect(await newsInstruments([get('BYMA:JPMD:USD')], resolve)).toEqual([stock]);
    expect(resolve).toHaveBeenCalledWith(stock.id);
  });
  it('preserves distinct assets and never guesses an issuer by removing a ticker suffix', async () => {
    const unknown = { ...get('BYMA:AAPL:ARS'), underlyingId: undefined };
    const resolve = vi.fn(async () => {
      throw Error('unavailable');
    });
    const result = await newsInstruments(
      [unknown, get('NASDAQ:MSFT:USD'), get('CASH:USD:USD')],
      resolve,
    );
    expect(result).toEqual([unknown, get('NASDAQ:MSFT:USD')]);
    expect(resolve).not.toHaveBeenCalled();
  });
  it('retains an unresolved certificate when its issuer cannot be recovered', async () => {
    const item = get('BYMA:AAPL:ARS');
    expect(
      await newsInstruments([item], async () => {
        throw Error('unavailable');
      }),
    ).toEqual([item]);
  });
});
