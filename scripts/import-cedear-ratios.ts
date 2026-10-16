import Decimal from 'decimal.js';
import { readFile } from 'node:fs/promises';
import { and, eq } from 'drizzle-orm';
import { connectDatabase } from '../src/lib/db';
import { cedearRatios, instrumentTable } from '../src/lib/db/schema';
import { ratioImportSchema } from '../src/lib/market/ratio-import';
async function main() {
  const file = process.argv[2];
  if (!file)
    throw new Error('Usage: npm run data:import-ratios -- /absolute/path/authorized-ratios.json');
  const data = ratioImportSchema.parse(JSON.parse(await readFile(file, 'utf8')));
  const connection = await connectDatabase();
  try {
    await connection.db.transaction(async (tx) => {
      for (const item of data.ratios) {
        const [listing] = await tx
          .select()
          .from(instrumentTable)
          .where(eq(instrumentTable.id, item.instrumentId));
        const [underlying] = await tx
          .select()
          .from(instrumentTable)
          .where(eq(instrumentTable.id, item.underlyingId));
        if (
          !listing ||
          !underlying ||
          listing.data.type !== 'cedear' ||
          listing.data.underlyingId !== item.underlyingId
        )
          throw new Error(`Invalid listing/underlying relation: ${item.instrumentId}`);
        const [prior] = await tx
          .select()
          .from(cedearRatios)
          .where(
            and(
              eq(cedearRatios.instrumentId, item.instrumentId),
              eq(cedearRatios.effectiveFrom, item.effectiveFrom),
            ),
          );
        if (prior) {
          if (!new Decimal(prior.certificatesPerShare).eq(item.certificatesPerShare))
            throw new Error(
              'Conflicting historical ratio; review the source before changing history.',
            );
          continue;
        }
        await tx.insert(cedearRatios).values({
          id: crypto.randomUUID(),
          ...item,
          source: data.source,
          retrievedAt: new Date(data.retrievedAt),
        });
      }
    });
    console.log(
      `Validated ${data.ratios.length} dated CEDEAR ratio records. Historical records retained.`,
    );
  } finally {
    await connection.close();
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Import failed');
  process.exitCode = 1;
});
