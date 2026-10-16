'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Search, ArrowUpRight, Globe2 } from 'lucide-react';
import { useApp } from './app-shell';
import { api } from '@/lib/utils';
import type { Instrument, MarketSnapshot } from '@/lib/market/types';
import { SectionTitle, AssetIcon, ErrorState, Skeleton } from './ui';
import { MarketTable } from './market-table';
export function Markets() {
  const { demo } = useApp();
  const [market, setMarket] = useState('Todos');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('default');
  const overview = useQuery({
    queryKey: ['overview', demo],
    queryFn: () => api<MarketSnapshot[]>(`overview${demo ? '?demo=true' : ''}`),
  });
  const results = useQuery({
    queryKey: ['instrument-search', search, demo],
    queryFn: () =>
      api<{ instruments: Instrument[]; error?: string }>(
        `instruments?q=${encodeURIComponent(search)}${demo ? '&demo=true' : ''}`,
      ),
  });
  let rows = (overview.data ?? []).filter(
    (r) =>
      (market === 'Todos' ||
        (market === 'Estados Unidos' && r.instrument.country === 'US') ||
        (market === 'Cripto' && r.instrument.type === 'crypto') ||
        (market === 'Argentina' && r.instrument.country === 'AR') ||
        (market === 'ETFs' && r.instrument.type === 'etf')) &&
      `${r.instrument.symbol} ${r.instrument.name}`.toLowerCase().includes(search.toLowerCase()),
  );
  if (sort !== 'default')
    rows = [...rows].sort((a, b) =>
      sort === 'volume'
        ? Number(b.quote?.volume ?? 0) - Number(a.quote?.volume ?? 0)
        : sort === 'gainers'
          ? Number(b.quote?.changePercent ?? 0) - Number(a.quote?.changePercent ?? 0)
          : Number(a.quote?.changePercent ?? 0) - Number(b.quote?.changePercent ?? 0),
    );
  const related =
    results.data?.instruments.filter(
      (i) =>
        !rows.some((r) => r.instrument.id === i.id) &&
        (market !== 'Argentina' || i.country === 'AR'),
    ) ?? [];
  return (
    <>
      <SectionTitle
        eyebrow="MARKET EXPLORER"
        title="Un mundo de oportunidades."
        description="Descubrí instrumentos. Entendé qué estás mirando."
        action={
          <span className="outlined-chip">
            <Globe2 size={14} /> Cobertura multimercado
          </span>
        }
      />
      <div className="panel markets-panel">
        <div className="market-filters">
          <div className="tabs">
            {['Todos', 'Estados Unidos', 'Cripto', 'Argentina', 'ETFs'].map((t) => (
              <button key={t} onClick={() => setMarket(t)} className={market === t ? 'active' : ''}>
                {t}
              </button>
            ))}
          </div>
          <div className="market-search">
            <Search size={16} />
            <input
              value={search}
              aria-label="Filtrar instrumentos"
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ticker o nombre..."
            />
          </div>
          <select
            aria-label="Ordenar instrumentos"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="default">Destacados</option>
            <option value="gainers">Mayores subas</option>
            <option value="losers">Mayores bajas</option>
            <option value="volume">Mayor volumen</option>
          </select>
        </div>
        {overview.isLoading ? (
          <Skeleton className="table-skeleton" />
        ) : overview.isError ? (
          <ErrorState message={overview.error.message} />
        ) : (
          <MarketTable rows={rows} />
        )}
        <div className="table-note">
          Catálogo inicial de descubrimiento; no representa la composición completa de ningún
          índice. El buscador consulta proveedores al habilitar el modo real.
        </div>
      </div>
      {related.length > 0 && (
        <section className="related-instruments">
          <h2>Más instrumentos y especies relacionadas</h2>
          <div className="related-grid">
            {related.slice(0, 16).map((i) => (
              <Link
                key={i.id}
                href={`/asset/${i.exchange}/${i.symbol}${demo ? '?demo=true' : ''}`}
                className="panel related-card"
              >
                <AssetIcon instrument={i} />
                <div>
                  <strong>
                    {i.symbol} <span className="type-tag">{i.type.toUpperCase()}</span>
                  </strong>
                  <p>{i.name}</p>
                  <small>
                    {i.exchange} · {i.currency}
                  </small>
                </div>
                <ArrowUpRight size={16} />
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
