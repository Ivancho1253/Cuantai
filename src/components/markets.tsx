'use client';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Globe2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useApp } from './app-shell';
import { api } from '@/lib/utils';
import type { MarketSnapshot } from '@/lib/market/types';
import { SectionTitle, ErrorState, Skeleton } from './ui';
import { MarketTable } from './market-table';

type CatalogPage = {
  rows: MarketSnapshot[];
  total: number;
  page: number;
  pageSize: number;
  counts: { sp500: number; crypto: number; cedears: number; cedearListings: number; total: number };
  dates: { sp500: string; crypto: string; cedears: string };
};
export function Markets() {
  const { demo } = useApp();
  const [market, setMarket] = useState('Todos');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('default');
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);
  const catalog = useQuery({
    queryKey: ['market-catalog', market, query, page, demo],
    queryFn: () =>
      api<CatalogPage>(
        `market-catalog?${new URLSearchParams({ category: market, q: query, page: String(page), ...(demo ? { demo: 'true' } : {}) })}`,
      ),
  });
  const data = catalog.data;
  const rows = [...(data?.rows ?? [])];
  if (sort !== 'default')
    rows.sort((a, b) => {
      if (!a.quote) return b.quote ? 1 : 0;
      if (!b.quote) return -1;
      return sort === 'volume'
        ? Number(b.quote.volume ?? 0) - Number(a.quote.volume ?? 0)
        : sort === 'gainers'
          ? Number(b.quote.changePercent) - Number(a.quote.changePercent)
          : Number(a.quote.changePercent) - Number(b.quote.changePercent);
    });
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return (
    <>
      <SectionTitle
        eyebrow="MARKET EXPLORER"
        title="Un mundo de oportunidades."
        description="S&P 500, Coin100 y todos los CEDEARs del listado de BYMA. Buscá por ticker o nombre."
        action={
          <span className="outlined-chip">
            <Globe2 size={14} /> Cobertura multimercado
          </span>
        }
      />
      {data && (
        <div className="catalog-coverage">
          <span>
            <strong>{data.counts.sp500}</strong> acciones del S&P 500
          </span>
          <span>
            <strong>{data.counts.crypto}</strong> criptomonedas · Coin100
          </span>
          <span>
            <strong>{data.counts.cedears}</strong> programas CEDEAR
          </span>
        </div>
      )}
      <div className="panel markets-panel">
        <div className="market-filters">
          <div className="tabs" role="group" aria-label="Filtrar mercado">
            {['Todos', 'S&P 500', 'Coin100', 'CEDEARs', 'Estados Unidos', 'Argentina', 'ETFs'].map(
              (t) => (
                <button
                  key={t}
                  aria-pressed={market === t}
                  onClick={() => {
                    setMarket(t);
                    setPage(1);
                  }}
                  className={market === t ? 'active' : ''}
                >
                  {t}
                </button>
              ),
            )}
          </div>
          <div className="market-search">
            <Search size={16} />
            <input
              value={search}
              aria-label="Filtrar instrumentos"
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Ticker o nombre..."
            />
          </div>
          <select
            aria-label="Ordenar página de instrumentos"
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            <option value="default">
              {market === 'Coin100' ? 'Ranking por capitalización' : 'Destacados'}
            </option>
            <option value="gainers">Subas de esta página</option>
            <option value="losers">Bajas de esta página</option>
            <option value="volume">Volumen de esta página</option>
          </select>
        </div>
        {catalog.isPending ? (
          <Skeleton className="table-skeleton" />
        ) : catalog.isError ? (
          <ErrorState message={catalog.error.message} retry={() => catalog.refetch()} />
        ) : rows.length ? (
          <MarketTable rows={rows} />
        ) : (
          <div className="catalog-empty" role="status">
            No se encontraron activos. Probá otro ticker o nombre.
          </div>
        )}
        {data && (
          <nav className="catalog-pagination" aria-label="Páginas de activos">
            <span>
              {data.total
                ? `${(data.page - 1) * data.pageSize + 1}–${Math.min(data.page * data.pageSize, data.total)} de ${data.total.toLocaleString('es-AR')} activos`
                : '0 activos'}
            </span>
            <div>
              <button
                className="button button-secondary"
                disabled={data.page <= 1}
                onClick={() => setPage(data.page - 1)}
                aria-label="Página anterior"
              >
                <ChevronLeft size={14} />
              </button>
              <span>
                Página {data.page} de {pages}
              </span>
              <button
                className="button button-secondary"
                disabled={data.page >= pages}
                onClick={() => setPage(data.page + 1)}
                aria-label="Página siguiente"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </nav>
        )}
        <div className="table-note">
          S&P 500: cartera de acciones publicada por State Street SPY
          {data ? ` · ${data.dates.sp500}` : ''}. Coin100: top 100 por capitalización de CoinGecko,
          incluidas stablecoins y monedas envueltas
          {data ? ` · ${data.dates.crypto.slice(0, 10)}` : ''}. CEDEARs: listado BYMA y datos de
          Caja de Valores{data ? ` · ${data.dates.cedears}` : ''}. Las cotizaciones dependen de la
          cobertura y cuota de cada fuente; los datos de demostración se identifican como DEMO.
        </div>
      </div>
    </>
  );
}
