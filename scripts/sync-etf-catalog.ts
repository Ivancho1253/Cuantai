import { writeFile } from 'node:fs/promises';
const root = 'https://www.nasdaqtrader.com/dynamic/SymDir/';
const venues: Record<string, string> = {
  A: 'AMEX',
  N: 'NYSE',
  P: 'ARCA',
  Z: 'CBOE',
  V: 'IEX',
  F: 'TXSE',
};
async function main() {
  const entries: Record<string, { exchange: string; symbol: string; name: string }> = {};
  const files: Record<string, string> = {};
  for (const file of ['nasdaqlisted.txt', 'otherlisted.txt']) {
    const r = await fetch(root + file, { signal: AbortSignal.timeout(30000) });
    if (!r.ok) throw new Error(`Nasdaq directory HTTP ${r.status}`);
    const lines = (await r.text()).trim().split(/\r?\n/),
      headers = lines[0].split('|');
    if (!headers.includes('ETF') || !headers.includes('Test Issue'))
      throw new Error('Unexpected directory columns');
    for (const line of lines.slice(1)) {
      if (line.startsWith('File Creation Time:')) {
        files[file] = line.split('|')[0];
        continue;
      }
      const row = Object.fromEntries(
        line.split('|').map((value, index) => [headers[index], value.trim()]),
      );
      if (row.ETF !== 'Y' || row['Test Issue'] !== 'N') continue;
      const symbol = file === 'nasdaqlisted.txt' ? row.Symbol : row['ACT Symbol'];
      const exchange = file === 'nasdaqlisted.txt' ? 'NASDAQ' : venues[row.Exchange];
      if (
        !exchange ||
        !symbol ||
        !/^[A-Z0-9][A-Z0-9.-]{0,13}$/.test(symbol) ||
        !row['Security Name']
      )
        throw new Error('Unrecognized ETF listing');
      if (entries[symbol] && entries[symbol].exchange !== exchange)
        throw new Error('Duplicate ETF primary listing');
      entries[symbol] = { exchange, symbol, name: row['Security Name'] };
    }
  }
  const rows = Object.values(entries).sort((a, b) => a.symbol.localeCompare(b.symbol));
  if (rows.length < 1000) throw new Error('Refusing an unexpectedly small ETF directory');
  const result = {
    retrievedAt: new Date().toISOString(),
    sources: [root + 'nasdaqlisted.txt', root + 'otherlisted.txt'],
    fileCreationTimes: files,
    methodology:
      'US primary listings marked ETF=Y and Test Issue=N in the Nasdaq Trader symbol directories. Classification follows the publisher; no prices or fund holdings are inferred.',
    entries: rows,
  };
  await writeFile('src/lib/market/data/etfs.json', JSON.stringify(result, null, 2) + '\n');
  console.log('Imported ETF listings:', rows.length);
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
