'use client';
import { useText as useUiText } from './locale-provider';
import Link from 'next/link';
import { assetHref } from '@/lib/market/asset-href';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Star, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { sortMarketRows, type MarketSort, type MarketSortKey } from '@/lib/market/sorting';
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
  sort,
  onSort,
}: {
  rows: MarketSnapshot[];
  compactView?: boolean;
  onFavorite?: (id: string) => void;
  sort?: MarketSort | null;
  onSort?: (sort: MarketSort) => void;
}) {
  const uiText = useUiText();
  const { demo, user } = useApp();
  const [localSort, setLocalSort] = useState<MarketSort | null>(null);
  const ordering = onSort ? sort : localSort;
  function header(key: MarketSortKey, label: string) {
    const active = ordering?.key === key;
    const Icon = active ? (ordering.direction === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
      <th
        scope="col"
        aria-sort={active ? (ordering.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        <button
          className="market-sort-button"
          onClick={() => {
            const next: MarketSort = {
              key,
              direction:
                active && ordering.direction === 'desc'
                  ? 'asc'
                  : active
                    ? 'desc'
                    : key === 'asset' || key === 'rank'
                      ? 'asc'
                      : 'desc',
            };
            if (onSort) onSort(next);
            else setLocalSort(next);
          }}
        >
          {uiText(label)}
          <Icon size={13} aria-hidden="true" />
        </button>
      </th>
    );
  }
  const [favorite, setFavorite] = useState<string | null>(null);
  const ranked = rows.length > 0 && rows.every((row) => row.instrument.marketCapRank != null);
  const localEquities =
    rows.length > 0 &&
    rows.every((row) => row.instrument.type === 'stock' && row.instrument.country === 'AR');
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
      {uiText(
        favorite && (
          <WatchlistPicker
            instrumentId={favorite}
            open
            onOpenChange={(open) => !open && setFavorite(null)}
          />
        ),
      )}
      <table className="market-table">
        <thead>
          <tr>
            {uiText(
              (ranked || localEquities) && header('rank', localEquities ? 'Liquidez' : 'Ranking'),
            )}
            {header('asset', 'Activo')}
            {header('price', 'Precio')}
            {header('change', 'Cambio')}
            {!compactView && header('volume', 'Volumen')}
            <th>{uiText('Gr\u00E1fico')}</th>
            {uiText(!compactView && <th>{uiText('Mercado')}</th>)}
            <th>
              <span className="sr-only">{uiText('Acciones')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {uiText(
            sortMarketRows(rows, ordering).map((row) => {
              const q = row.quote;
              const up = Number(q?.changePercent ?? 0) >= 0;
              return (
                <tr key={row.instrument.id}>
                  {uiText(
                    ranked && (
                      <td className="numeric muted">#{uiText(row.instrument.marketCapRank)}</td>
                    ),
                  )}
                  {uiText(
                    localEquities && (
                      <td
                        className="numeric muted"
                        title={uiText(
                          row.instrument.liquidityRank
                            ? `ADTV 40 ruedas · ARS ${number(row.instrument.liquidityAdtvARS)} · ${row.instrument.liquidityAsOf}`
                            : 'Sin ADTV publicado',
                        )}
                      >
                        {uiText(
                          row.instrument.liquidityRank ? `#${row.instrument.liquidityRank}` : '—',
                        )}
                      </td>
                    ),
                  )}
                  <td>
                    <Link className="asset-cell" href={assetHref(row.instrument, demo)}>
                      <AssetIcon instrument={row.instrument} small />
                      <div>
                        <strong>
                          {uiText(row.instrument.symbol)}
                          <span className="type-tag">
                            {uiText(
                              row.instrument.type === 'crypto'
                                ? 'CRYPTO'
                                : row.instrument.type === 'cedear'
                                  ? 'CEDEAR'
                                  : row.instrument.type === 'etf'
                                    ? 'ETF'
                                    : '',
                            )}
                          </span>
                        </strong>
                        <small>{uiText(row.instrument.name)}</small>
                      </div>
                    </Link>
                  </td>
                  <td className="numeric">
                    <strong title={q ? `${q.source} · ${q.asOf}` : row.error}>
                      {uiText(formatPrice(q?.price))}
                    </strong>
                    <small>{uiText(row.instrument.currency)}</small>
                  </td>
                  <td className={cn('numeric', !q ? 'muted' : up ? 'positive' : 'negative')}>
                    {uiText(q ? `${up ? '+' : ''}${number(q.changePercent)}%` : '—')}
                  </td>
                  {uiText(
                    !compactView && (
                      <td
                        className="numeric muted"
                        title={q?.volumeUnit === 'USD' ? 'USD · 24h' : undefined}
                      >
                        {uiText(compact(q?.volume))}
                        {q?.volume != null && q.volumeUnit === 'USD' && <small>USD · 24h</small>}
                      </td>
                    ),
                  )}
                  <td className="spark-cell">
                    {uiText(
                      tradingViewSymbol(row.instrument) ? (
                        <a
                          className="text-link"
                          href={tradingViewChartUrl(tradingViewSymbol(row.instrument)!)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {uiText('TradingView ')}
                          <ArrowUpRight size={12} />
                        </a>
                      ) : (
                        <span className="muted">—</span>
                      ),
                    )}
                  </td>
                  {uiText(
                    !compactView && (
                      <td>
                        <small>{uiText(row.instrument.exchange)}</small>
                        <DataBadge status={q?.status ?? 'unavailable'} />
                      </td>
                    ),
                  )}
                  <td>
                    <div className="market-row-actions">
                      <button
                        className={cn(
                          'icon-button',
                          favoriteIds.has(row.instrument.id) && 'is-favorite',
                        )}
                        aria-label={uiText('Guardar {0} en watchlist', [row.instrument.symbol])}
                        title={uiText(
                          favoriteIds.has(row.instrument.id)
                            ? 'Guardado en favoritos · Administrar watchlists'
                            : 'Guardar en favoritos',
                        )}
                        onClick={() =>
                          onFavorite
                            ? onFavorite(row.instrument.id)
                            : setFavorite(row.instrument.id)
                        }
                      >
                        <Star
                          size={15}
                          fill={favoriteIds.has(row.instrument.id) ? 'currentColor' : 'none'}
                        />
                      </button>
                      <Link
                        className="icon-button"
                        aria-label={uiText('Abrir {0}', [row.instrument.symbol])}
                        href={assetHref(row.instrument, demo)}
                      >
                        <ArrowUpRight size={16} />
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            }),
          )}
        </tbody>
      </table>
    </div>
  );
}
