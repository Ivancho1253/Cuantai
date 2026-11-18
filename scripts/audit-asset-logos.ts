import { discoverInstruments } from '../src/lib/market/discovery';
import { assetLogo } from '../src/lib/market/logos';
import { writeFileSync } from 'node:fs';
const all = [];
for (let page = 1; ; page++) {
  const d = discoverInstruments({ page, pageSize: 100 });
  all.push(...d.instruments);
  if (page * 100 >= d.total) break;
}
const groups: Record<
  string,
  {
    total: number;
    local: number;
    remote: number;
    missing: { id: string; name: string; underlying?: string }[];
  }
> = {};
for (const type of ['stock', 'cedear', 'crypto', 'etf']) {
  const rows = all.filter((i) => i.type === type);
  groups[type] = {
    total: rows.length,
    local: rows.filter((i) => assetLogo(i)?.src.startsWith('/')).length,
    remote: rows.filter((i) => assetLogo(i)?.src.startsWith('http')).length,
    missing: rows
      .filter((i) => !assetLogo(i))
      .map((i) => ({ id: i.id, name: i.name, underlying: i.underlyingId })),
  };
}
writeFileSync('artifacts/logo-audit.json', JSON.stringify({ groups, all }, null, 2));
console.log(
  JSON.stringify(
    Object.fromEntries(
      Object.entries(groups).map(([k, v]) => [
        k,
        {
          ...v,
          missingCount: v.missing.length,
          missing: v.missing.slice(0, 8),
        },
      ]),
    ),
    null,
    2,
  ),
);
