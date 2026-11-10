import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { instrumentTable } from '@/lib/db/schema';
import { instruments } from '@/lib/market/catalog';
import { findDiscoveryListing } from '@/lib/market/discovery';
import { AppShell } from '@/components/app-shell';
import { AssetPage } from '@/components/asset-page';
export const dynamic = 'force-dynamic';
export default async function Asset({
  params,
  searchParams,
}: {
  params: Promise<{ exchange: string; symbol: string }>;
  searchParams: Promise<{ demo?: string }>;
}) {
  const { exchange, symbol } = await params;
  const query = await searchParams;
  const session = await getSession(await headers());
  let instrument =
    instruments.find((i) => i.exchange === exchange && i.symbol === symbol) ??
    findDiscoveryListing(exchange, symbol);
  if (!instrument) {
    const db = await getDb();
    const [row] = await db
      .select()
      .from(instrumentTable)
      .where(
        eq(instrumentTable.id, `${exchange}:${symbol}:${exchange === 'BINANCE' ? 'USDT' : 'USD'}`),
      );
    instrument = row?.data;
  }
  if (!instrument) notFound();
  return (
    <AppShell active="markets" user={session?.user} demo={query.demo === 'true' || !session}>
      <AssetPage instrument={instrument} />
    </AppShell>
  );
}
