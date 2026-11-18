import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { discoverInstruments } from '../src/lib/market/discovery';
import { assetLogo, type AssetLogo } from '../src/lib/market/logos';
type Reviewed = AssetLogo & { reviewedAt: string };
async function main() {
  const registry: Record<string, Reviewed> = JSON.parse(
    await readFile('src/lib/market/data/current-logos.json', 'utf8'),
  );
  const all = [];
  for (let page = 1; ; page++) {
    const p = discoverInstruments({ page, pageSize: 100 });
    all.push(...p.instruments);
    if (page * 100 >= p.total) break;
  }
  const queue = new Map<string, { logo: AssetLogo; ids: Set<string> }>();
  let external = 0;
  for (const i of all) {
    const logo = assetLogo(i);
    if (!logo) continue;
    // Existing remote images already request the provider's current URL at render time.
    if (!logo.src.startsWith('/')) {
      external++;
      continue;
    }
    if (
      logo.source.includes('aboutamazon.com') ||
      !/^https:\/\//.test(logo.source) ||
      logo.source.includes('developer/docs') ||
      logo.source.includes('github.com')
    )
      continue;
    const entry = queue.get(logo.source) ?? { logo, ids: new Set<string>() };
    entry.ids.add(i.type === 'cedear' ? (i.underlyingId ?? i.id) : i.id);
    queue.set(logo.source, entry);
  }
  // The original seed uses documentation as attribution: check its actual image endpoints too.
  const seed: Record<string, string> = {
    'NASDAQ:NVDA:USD': 'NVDA',
    'NASDAQ:AAPL:USD': 'AAPL',
    'NASDAQ:MSFT:USD': 'MSFT',
    'NASDAQ:GOOGL:USD': 'GOOGL',
    'NASDAQ:META:USD': 'META',
    'NASDAQ:TSLA:USD': 'TSLA',
    'NYSE:JPM:USD': 'JPM',
    'NYSE:BRK.B:USD': 'BRK.B',
    'NYSE:KO:USD': 'KO',
  };
  for (const [id, symbol] of Object.entries(seed)) {
    const i = all.find((i) => i.id === id);
    if (!i) continue;
    const logo = assetLogo(i);
    if (logo) {
      const source = 'https://images.financialmodelingprep.com/symbol/' + symbol + '.png';
      const entry = queue.get(source) ?? { logo, ids: new Set<string>() };
      entry.ids.add(id);
      queue.set(source, entry);
    }
  }
  const jobs = [...queue.entries()];
  const report: { source: string; status: string; ids: string[] }[] = [];
  let updated = 0,
    unchanged = 0,
    unavailable = 0;
  const pixelHash = async (b: Buffer) =>
    createHash('sha256')
      .update(
        await sharp(b)
          .resize(96, 96, { fit: 'contain', background: '#00000000' })
          .ensureAlpha()
          .raw()
          .toBuffer(),
      )
      .digest('hex');
  await mkdir('public/asset-logos/current', { recursive: true });
  await mkdir('artifacts', { recursive: true });
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      for (;;) {
        const job = jobs.shift();
        if (!job) break;
        const [url, { logo, ids }] = job;
        try {
          const response = await fetch(url, {
            signal: AbortSignal.timeout(6500),
            headers: { 'User-Agent': 'Mozilla/5.0' },
          });
          if (!response.ok) throw Error('HTTP ' + response.status);
          const bytes = Buffer.from(await response.arrayBuffer());
          if (bytes.length < 50 || bytes.length > 512000) throw Error('size');
          const meta = await sharp(bytes).metadata();
          if (!meta.width || !meta.height || Math.min(meta.width, meta.height) < 16)
            throw Error('invalid image');
          const old = await readFile('public' + logo.src);
          if ((await pixelHash(bytes)) === (await pixelHash(old))) {
            unchanged++;
            report.push({ source: url, status: 'unchanged', ids: [...ids] });
            continue;
          }
          const png = await sharp(bytes)
            .resize(128, 128, { fit: 'contain', background: '#00000000' })
            .png()
            .toBuffer();
          const rgba = await sharp(png).resize(32, 32).ensureAlpha().raw().toBuffer();
          let visible = 0,
            white = 0,
            trans = 0;
          for (let n = 0; n < rgba.length; n += 4) {
            const alpha = rgba[n + 3] / 255;
            visible += alpha;
            if (alpha < 0.5) trans++;
            if (Math.min(rgba[n], rgba[n + 1], rgba[n + 2]) > 200) white += alpha;
          }
          const background =
            trans > 100 && visible > 0 && white / visible > 0.85 ? '#1d2b34' : '#ffffff';
          const hash = createHash('sha256').update(png).digest('hex').slice(0, 16),
            file = hash + '.png';
          await writeFile('public/asset-logos/current/' + file, png);
          for (const id of ids)
            registry[id] = {
              src: '/asset-logos/current/' + file,
              name: logo.name,
              source: url,
              background,
              reviewedAt: new Date().toISOString().slice(0, 10),
            };
          updated++;
          report.push({ source: url, status: 'updated', ids: [...ids] });
        } catch {
          unavailable++;
          report.push({ source: url, status: 'kept-existing', ids: [...ids] });
        }
      }
    }),
  );
  const managers = JSON.parse(
    await readFile('src/lib/market/data/fund-issuer-logos.json', 'utf8'),
  ) as { source: string; src: string; background: string }[];
  for (const [id, value] of Object.entries(registry)) {
    const manager = managers.find((item) => item.source === value.source);
    if (manager) {
      manager.src = value.src;
      manager.background = value.background;
      delete registry[id];
    }
  }
  await writeFile(
    'src/lib/market/data/fund-issuer-logos.json',
    JSON.stringify(managers, null, 2) + '\n',
  );
  await writeFile(
    'src/lib/market/data/current-logos.json',
    JSON.stringify(registry, null, 2) + '\n',
  );
  await writeFile(
    'artifacts/brand-refresh-audit.json',
    JSON.stringify(
      { reviewedAt: new Date().toISOString(), updated, unchanged, unavailable, external, report },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ updated, unchanged, unavailable, external }));
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
