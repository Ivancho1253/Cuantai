import type { Instrument } from './types';

/** News belongs to the underlying issuer; quotation currencies are not separate news subjects. */
export async function newsInstruments(
  input: Instrument[],
  resolve: (id: string) => Promise<Instrument>,
): Promise<Instrument[]> {
  const issuers = await Promise.all(
    input
      .filter((item) => item.type !== 'cash')
      .map(async (item) => {
        if (item.type !== 'cedear' || !item.underlyingId) return item;
        try {
          return await resolve(item.underlyingId);
        } catch {
          return item;
        }
      }),
  );
  return [...new Map(issuers.map((item) => [item.id, item])).values()];
}
