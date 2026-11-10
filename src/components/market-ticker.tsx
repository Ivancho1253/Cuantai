'use client';

import { useState } from 'react';
import Link from 'next/link';
import { assetHref } from '@/lib/market/asset-href';
import { useQueries, useQuery } from '@tanstack/react-query';
import { Flame, Pause, Play, Star } from 'lucide-react';
import { useApp } from './app-shell';
import type { Watchlist } from './watchlists';
import type { MarketSnapshot } from '@/lib/market/types';
import { api, cn, number, formatPrice } from '@/lib/utils';
import { DataBadge } from './ui';

export function MarketTicker() {
  const { user, demo, href } = useApp();
  const [mode, setMode] = useState<'hots' | 'favorites'>('hots');
  const [paused, setPaused] = useState(false);
  const overview = useQuery({
    queryKey: ['overview', demo],
    queryFn: () => api<MarketSnapshot[]>(`overview${demo ? '?demo=true' : ''}`),
    refetchInterval: 60000,
  });
  const lists = useQuery({
    queryKey: ['watchlists'],
    queryFn: () => api<Watchlist[]>('watchlists'),
    enabled: Boolean(user) && !demo,
  });
  const favorites =
    user && !demo
      ? [
          ...new Map(
            (lists.data ?? []).flatMap((list) =>
              list.items.map(({ instrument }) => [instrument.id, instrument] as const),
            ),
          ).values(),
        ]
      : [];
  // Watchlists may contain CEDEARs or search results outside the overview catalog.
  const extraQuotes = useQueries({
    queries: favorites
      .filter((instrument) => !overview.data?.some((row) => row.instrument.id === instrument.id))
      .map((instrument) => ({
        queryKey: ['market', instrument.id, '1D', demo],
        queryFn: () =>
          api<MarketSnapshot>(
            `market?id=${encodeURIComponent(instrument.id)}${demo ? '&demo=true' : ''}`,
          ),
        enabled: mode === 'favorites' && !overview.isPending,
        refetchInterval: 60000,
      })),
  });
  const snapshots = [
    ...(overview.data ?? []),
    ...extraQuotes.flatMap((query) => (query.data ? [query.data] : [])),
  ];
  const rows =
    mode === 'hots'
      ? [...(overview.data ?? [])]
          .filter((row) => row.quote && Number.isFinite(Number(row.quote.changePercent)))
          .sort(
            (a, b) =>
              Math.abs(Number(b.quote!.changePercent)) - Math.abs(Number(a.quote!.changePercent)),
          )
          .slice(0, 12)
      : favorites.map((instrument) => ({
          instrument,
          quote: snapshots.find((row) => row.instrument.id === instrument.id)?.quote ?? null,
        }));
  const loading = overview.isPending || (mode === 'favorites' && user && !demo && lists.isPending);
  const failed = mode === 'hots' ? overview.isError : Boolean(user) && !demo && lists.isError;
  const message = loading
    ? 'Cargando cotizaciones…'
    : failed
      ? 'No se pudo cargar la cinta.'
      : mode === 'favorites'
        ? !user || demo
          ? 'Iniciá sesión para ver tus favoritos.'
          : 'Guardá activos con la estrella para verlos acá.'
        : 'No hay cotizaciones disponibles.';

  return (
    <section className="market-ticker" aria-label="Cinta de cotizaciones">
      <div className="market-ticker-controls">
        <div className="market-ticker-modes" role="group" aria-label="Activos de la cinta">
          <button
            type="button"
            aria-pressed={mode === 'hots'}
            onClick={() => setMode('hots')}
            title="Mayor variación porcentual diaria del catálogo disponible"
          >
            <Flame size={13} /> Hots
          </button>
          <button
            type="button"
            aria-pressed={mode === 'favorites'}
            onClick={() => setMode('favorites')}
          >
            <Star size={13} /> Favoritos
          </button>
        </div>
        <button
          type="button"
          className="icon-button ticker-pause"
          aria-label={paused ? 'Reanudar cinta' : 'Pausar cinta'}
          onClick={() => setPaused(!paused)}
        >
          {paused ? <Play size={12} /> : <Pause size={12} />}
        </button>
      </div>
      {rows.length ? (
        <div className="market-ticker-viewport">
          <div
            className={cn('market-ticker-track', paused && 'is-paused')}
            style={{ animationDuration: `${Math.max(30, rows.length * 6)}s` }}
            key={mode}
          >
            {[false, true].map((duplicate) => (
              <div
                className="market-ticker-group"
                key={String(duplicate)}
                aria-hidden={duplicate || undefined}
              >
                {rows.map(({ instrument, quote }) => {
                  const change = quote ? Number(quote.changePercent) : null;
                  return (
                    <Link
                      className="market-ticker-item"
                      tabIndex={duplicate ? -1 : undefined}
                      key={instrument.id}
                      href={assetHref(instrument, demo)}
                      title={`${instrument.name} · ${instrument.exchange}${quote ? ` · ${quote.asOf}` : ' · Cotización no disponible'}`}
                    >
                      <strong>{instrument.symbol}</strong>
                      <small>{instrument.exchange}</small>
                      <span>
                        {formatPrice(quote?.price)} <small>{instrument.currency}</small>
                      </span>
                      <span
                        className={cn(
                          'ticker-change',
                          change !== null && (change >= 0 ? 'positive' : 'negative'),
                        )}
                      >
                        {change === null
                          ? 'Sin cotización'
                          : `${change >= 0 ? '+' : ''}${number(change)}%`}
                      </span>
                      <DataBadge status={quote?.status ?? 'unavailable'} />
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="market-ticker-empty" role="status">
          <span>{message}</span>
          {failed ? (
            <button onClick={() => (mode === 'hots' ? overview.refetch() : lists.refetch())}>
              Reintentar
            </button>
          ) : (
            !loading &&
            mode === 'favorites' && (
              <Link href={!user || demo ? '/login' : href('watchlists')}>
                {!user || demo ? 'Iniciar sesión' : 'Ver watchlists'}
              </Link>
            )
          )}
        </div>
      )}
    </section>
  );
}
