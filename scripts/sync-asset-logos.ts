import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { discoverInstruments } from '../src/lib/market/discovery';
import sharp from 'sharp';
type Entry = { src: string; source: string; background?: string };
async function main() {
  const manifest: Record<string, Entry> = JSON.parse(
    await readFile('src/lib/market/data/asset-logos.json', 'utf8'),
  );
  await mkdir('public/asset-logos/catalog', { recursive: true });
  const all = [];
  for (let page = 1; ; page++) {
    const result = discoverInstruments({ page, pageSize: 100 });
    all.push(...result.instruments);
    if (page * 100 >= result.total) break;
  }
  let coins: Record<string, string> = {};
  try {
    const ids = all
      .filter((i) => i.exchange === 'COINGECKO')
      .map((i) => i.providerSymbol)
      .join(',');
    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${encodeURIComponent(ids)}&per_page=250`,
    );
    if (response.ok)
      coins = Object.fromEntries(
        (await response.json()).map((coin: { id: string; image: string }) => [coin.id, coin.image]),
      );
  } catch {
    /* Keep existing verified assets if the public service is unavailable. */
  }
  const requested = new Set(process.argv.slice(2).flatMap((arg) => arg.split(',')));
  const queue = all.filter(
    (i) => i.type !== 'cedear' && i.type !== 'cash' && (!requested.size || requested.has(i.symbol)),
  );
  let good = 0,
    missing = 0;
  await Promise.all(
    Array.from({ length: 5 }, async () => {
      for (;;) {
        const i = queue.shift();
        if (!i) break;
        const url =
          i.exchange === 'COINGECKO'
            ? coins[i.providerSymbol!]
            : `https://images.financialmodelingprep.com/symbol/${i.symbol}${i.exchange === 'BYMA' ? '.BA' : ''}.png`;
        if (!url) {
          missing++;
          continue;
        }
        try {
          if (
            ![
              'images.financialmodelingprep.com',
              'coin-images.coingecko.com',
              'assets.coingecko.com',
            ].includes(new URL(url).hostname)
          )
            throw Error('host');
          const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
          if (!response.ok) throw Error('unavailable');
          const bytes = Buffer.from(await response.arrayBuffer());
          if (bytes.length < 50 || bytes.length > 512000) throw Error('size');
          const ext = bytes.subarray(0, 4).equals(Buffer.from([137, 80, 78, 71]))
            ? 'png'
            : bytes[0] === 255 && bytes[1] === 216
              ? 'jpg'
              : bytes.toString('ascii', 8, 12) === 'WEBP'
                ? 'webp'
                : null;
          if (!ext) throw Error('format');
          const file = i.id.replace(/[^a-zA-Z0-9._-]/g, '_') + '.' + ext;
          await writeFile('public/asset-logos/catalog/' + file, bytes);
          const { data } = await sharp(bytes)
            .resize(32, 32)
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });
          let visible = 0,
            light = 0,
            transparent = 0;
          for (let pixel = 0; pixel < data.length; pixel += 4) {
            const alpha = data[pixel + 3] / 255;
            visible += alpha;
            if (alpha < 0.5) transparent++;
            if (Math.min(data[pixel], data[pixel + 1], data[pixel + 2]) > 200) light += alpha;
          }
          const background =
            transparent > 100 && visible > 0 && light / visible > 0.85 ? '#1d2b34' : '#ffffff';
          manifest[i.id] = { src: '/asset-logos/catalog/' + file, source: url, background };
          good++;
        } catch {
          missing++;
        }
      }
    }),
  );
  await writeFile('src/lib/market/data/asset-logos.json', JSON.stringify(manifest, null, 2) + '\n');
  console.log(
    JSON.stringify({
      downloaded: good,
      unavailable: missing,
      stored: Object.keys(manifest).length,
    }),
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
