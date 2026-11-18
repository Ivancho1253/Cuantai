import { readFile, writeFile, mkdir } from 'node:fs/promises';
import sharp from 'sharp';
import { discoverInstruments } from '../src/lib/market/discovery';
import { assetLogo, type AssetLogo } from '../src/lib/market/logos';
import cedears from '../src/lib/market/data/cedears.json';
async function main() {
  const all = [];
  for (let page = 1; ; page++) {
    const d = discoverInstruments({ page, pageSize: 100 });
    all.push(...d.instruments);
    if (page * 100 >= d.total) break;
  }
  const manifest: Record<string, AssetLogo> = JSON.parse(
    await readFile('src/lib/market/data/certificate-logos.json', 'utf8'),
  );
  const normalize = (name: string) =>
    name
      .toLowerCase()
      .replace(
        /\b(incorporated|inc|corporation|corp|company|co|limited|ltd|plc|group|holding|holdings|s a|sa|etf|cedear|the|class|ordinary|shares|adr)\b/g,
        ' ',
      )
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 2);
  const agrees = (a: string, b: string) => {
    const aa = normalize(a),
      bb = normalize(b);
    const matches = aa.filter((w) => bb.includes(w));
    return (
      matches.length > 0 &&
      matches.length / Math.min(aa.length, bb.length) >= 0.8 &&
      (matches.length >= 2 || Math.max(aa.length, bb.length) <= 2)
    );
  };
  const candidates = all.filter((i) => i.type === 'stock' && i.country === 'US');
  let shared = 0,
    downloaded = 0,
    missing = 0;
  const queue = all.filter((i) => i.type === 'cedear' && !assetLogo(i));
  await mkdir('public/asset-logos/certificates', { recursive: true });
  await Promise.all(
    Array.from({ length: 5 }, async () => {
      for (;;) {
        const i = queue.shift();
        if (!i) break;
        const matching = candidates.filter((c) => agrees(i.name, c.name));
        if (matching.length === 1) {
          const logo = assetLogo(matching[0]);
          if (logo?.src.startsWith('/')) {
            manifest[i.id] = { ...logo, name: matching[0].name };
            shared++;
            continue;
          }
        }
        const entry = cedears.entries.find((e) => e.symbol === i.symbol);
        const supplied = entry && 'underlyingSymbol' in entry ? entry.underlyingSymbol : undefined;
        const symbol =
          supplied ??
          (
            {
              ADGO: 'AGRO',
              BRKB: 'BRK-B',
              BBD: 'BBD',
              ABEV3: 'ABEV3.SA',
              VALE3: 'VALE3.SA',
              PETR3: 'PETR3.SA',
              ITUB3: 'ITUB3.SA',
            } as Record<string, string>
          )[i.symbol] ??
          i.symbol;
        try {
          const profileUrl =
            'https://query1.finance.yahoo.com/v8/finance/chart/' +
            encodeURIComponent(symbol) +
            '?interval=1d&range=1d';
          const response = await fetch(profileUrl, { signal: AbortSignal.timeout(5000) });
          if (!response.ok) throw Error();
          const data = await response.json();
          const meta = data.chart?.result?.[0]?.meta;
          if (
            !meta ||
            meta.symbol?.toUpperCase() !== symbol.toUpperCase() ||
            !agrees(i.name, meta.longName ?? meta.shortName ?? '')
          )
            throw Error('Issuer identity could not be confirmed');
          const url =
            'https://images.financialmodelingprep.com/symbol/' +
            encodeURIComponent(symbol.replace('-', '.')) +
            '.png';
          const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
          if (!r.ok) throw Error();
          const bytes = Buffer.from(await r.arrayBuffer());
          if (bytes.length < 100 || bytes.length > 512000) throw Error();
          const png = await sharp(bytes)
            .resize(128, 128, { fit: 'contain', background: '#fff' })
            .png()
            .toBuffer();
          const file = i.id.replace(/[^a-z0-9]/gi, '_') + '.png';
          await writeFile('public/asset-logos/certificates/' + file, png);
          manifest[i.id] = {
            src: '/asset-logos/certificates/' + file,
            name: meta.longName ?? i.name,
            background: '#ffffff',
            source: url,
          };
          downloaded++;
        } catch {
          missing++;
        }
      }
    }),
  );
  await writeFile(
    'src/lib/market/data/certificate-logos.json',
    JSON.stringify(manifest, null, 2) + '\n',
  );
  console.log(JSON.stringify({ shared, downloaded, unverified: missing }));
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
