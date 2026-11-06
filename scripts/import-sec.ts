import { readFile, stat, mkdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { secSnapshotSchema } from '../src/lib/market/sec';
import { normalizeStatements } from '../src/lib/finance/statements';

async function main() {
  const input = process.argv[2];
  if (!input) throw new Error('Uso: npm run data:import-sec -- /ruta/al/bundle-sec.json');
  if ((await stat(input)).size > 25000000) throw new Error('El archivo SEC supera 25 MB.');
  const bundle = secSnapshotSchema.parse(JSON.parse(await readFile(input, 'utf8')));
  const ciks = new Set<number>();
  for (const facts of bundle.companyFacts) {
    if (ciks.has(facts.cik)) throw new Error('CIK duplicado en el archivo.');
    ciks.add(facts.cik);
    const normalized = normalizeStatements(facts, {
      instrumentId: `SEC:${facts.cik}`,
      retrievedAt: bundle.retrievedAt,
      financialSector: false,
      delivery: 'imported-snapshot',
    });
    if (!normalized.periods.length)
      throw new Error(`No hay ejercicios anuales compatibles para CIK ${facts.cik}.`);
  }
  const destination = path.resolve(
    process.env.SEC_COMPANYFACTS_FILE || '.data/sec-companyfacts.json',
  );
  await mkdir(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.${crypto.randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(bundle), { mode: 0o600 });
  await rename(temporary, destination);
  console.log(`Importados ${ciks.size} emisores. Archivo: ${destination}`);
  console.log('Configurá SEC_COMPANYFACTS_FILE con esa ruta y reiniciá el servidor.');
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'SEC import failed');
  process.exitCode = 1;
});
