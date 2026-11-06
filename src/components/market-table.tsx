'use client';
import Link from 'next/link';
import { ArrowUpRight, Star } from 'lucide-react';
import { AssetIcon, DataBadge } from './ui';
import { tradingViewSymbol, tradingViewChartUrl } from '@/lib/market/tradingview';
import { number, compact, cn } from '@/lib/utils';
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
  const { demo } = useApp();
  return (
    <div className="table-scroll">
      <table className="market-table">
        <thead>
          <tr>
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
                <td>
                  <Link
                    className="asset-cell"
                    href={`/asset/${row.instrument.exchange}/${row.instrument.symbol}${demo ? '?demo=true' : ''}`}
                  >
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
                  <strong>{number(q?.price)}</strong>
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
                  {onFavorite ? (
                    <button
                      className="icon-button"
                      aria-label={`Agregar ${row.instrument.symbol} a watchlist`}
                      onClick={() => onFavorite(row.instrument.id)}
                    >
                      <Star size={15} />
                    </button>
                  ) : (
                    <Link
                      className="icon-button"
                      aria-label={`Abrir ${row.instrument.symbol}`}
                      href={`/asset/${row.instrument.exchange}/${row.instrument.symbol}${demo ? '?demo=true' : ''}`}
                    >
                      <ArrowUpRight size={16} />
                    </Link>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
