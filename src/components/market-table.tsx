'use client';
import Link from 'next/link';
import { assetHref } from '@/lib/market/asset-href';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Star } from 'lucide-react';
import { AssetIcon, DataBadge } from './ui';
import { tradingViewSymbol, tradingViewChartUrl } from '@/lib/market/tradingview';
import { api, number, formatPrice, compact, cn } from '@/lib/utils';
import { WatchlistPicker, type Watchlist } from './watchlists';
import type { MarketSnapshot } from '@/lib/market/types';
import { useApp } from './app-shell';
export function MarketTable({
  rows,
  compactView = false,
  onFavorite,
}: {
  rows: MarketSnapshot[];
  compactView?: boolean;
  onFavorite?: (id: string) => void;
}) {
  const { demo, user } = useApp();
  const [favorite, setFavorite] = useState<string | null>(null);
  const ranked = rows.length > 0 && rows.every((row) => row.instrument.marketCapRank != null);
  const lists = useQuery({
    queryKey: ['watchlists'],
    queryFn: () => api<Watchlist[]>('watchlists'),
    enabled: Boolean(user) && !demo,
  });
  const favoriteIds = new Set(
    user && !demo
      ? lists.data?.flatMap((list) => list.items.map(({ instrument }) => instrument.id))
      : [],
  );
  return (
    <div className="table-scroll">
      {favorite && (
        <WatchlistPicker
          instrumentId={favorite}
          open
          onOpenChange={(open) => !open && setFavorite(null)}
        />
      )}
      <table className="market-table">
        <thead>
          <tr>
            {ranked && <th scope="col">Ranking</th>}
            <th>Activo</th>
            <th>Precio</th>
            <th>Cambio</th>
            {!compactView && <th>Volumen</th>}
            <th>Gráfico</th>
            {!compactView && <th>Mercado</th>}
            <th>
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const q = row.quote;
            const up = Number(q?.changePercent ?? 0) >= 0;
            return (
              <tr key={row.instrument.id}>
                {ranked && <td className="numeric muted">#{row.instrument.marketCapRank}</td>}
                <td>
                  <Link className="asset-cell" href={assetHref(row.instrument, demo)}>
                    <AssetIcon instrument={row.instrument} small />
                    <div>
                      <strong>
                        {row.instrument.symbol}
                        <span className="type-tag">
                          {row.instrument.type === 'crypto'
                            ? 'CRYPTO'
                            : row.instrument.type === 'cedear'
                              ? 'CEDEAR'
                              : row.instrument.type === 'etf'
                                ? 'ETF'
                                : ''}
                        </span>
                      </strong>
                      <small>{row.instrument.name}</small>
                    </div>
                  </Link>
                </td>
                <td className="numeric">
                  <strong>{formatPrice(q?.price)}</strong>
                  <small>{row.instrument.currency}</small>
                </td>
                <td className={cn('numeric', up ? 'positive' : 'negative')}>
                  {q ? `${up ? '+' : ''}${number(q.changePercent)}%` : '—'}
                </td>
                {!compactView && <td className="numeric muted">{compact(q?.volume)}</td>}
                <td className="spark-cell">
                  {tradingViewSymbol(row.instrument) ? (
                    <a
                      className="text-link"
                      href={tradingViewChartUrl(tradingViewSymbol(row.instrument)!)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      TradingView <ArrowUpRight size={12} />
                    </a>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                {!compactView && (
                  <td>
                    <small>{row.instrument.exchange}</small>
                    <DataBadge status={q?.status ?? 'unavailable'} />
                  </td>
                )}
                <td>
                  <div className="market-row-actions">
                    <button
                      className={cn(
                        'icon-button',
                        favoriteIds.has(row.instrument.id) && 'is-favorite',
                      )}
                      aria-label={`Guardar ${row.instrument.symbol} en watchlist`}
                      title={
                        favoriteIds.has(row.instrument.id)
                          ? 'Guardado en favoritos · Administrar watchlists'
                          : 'Guardar en favoritos'
                      }
                      onClick={() =>
                        onFavorite ? onFavorite(row.instrument.id) : setFavorite(row.instrument.id)
                      }
                    >
                      <Star
                        size={15}
                        fill={favoriteIds.has(row.instrument.id) ? 'currentColor' : 'none'}
                      />
                    </button>
                    <Link
                      className="icon-button"
                      aria-label={`Abrir ${row.instrument.symbol}`}
                      href={assetHref(row.instrument, demo)}
                    >
                      <ArrowUpRight size={16} />
                    </Link>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
