'use client';
import { useText as useUiText } from './locale-provider';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Globe2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useApp } from './app-shell';
import { api } from '@/lib/utils';
import type { MarketSnapshot } from '@/lib/market/types';
import { SectionTitle, ErrorState, Skeleton } from './ui';
import { MarketTable } from './market-table';
import { marketCategories } from '@/lib/market/categories';
import { WatchlistPicker } from './watchlists';
import type { MarketSort, MarketSortKey } from '@/lib/market/sorting';
type CatalogPage = {
  rows: MarketSnapshot[];
  total: number;
  page: number;
  pageSize: number;
  counts: {
    sp500: number;
    crypto: number;
    etfs: number;
    cedears: number;
    cedearListings: number;
    argentina: number;
    argentinaRanked: number;
    argentinaMerval: number;
    total: number;
  };
  dates: {
    sp500: string;
    crypto: string;
    cedears: string;
    argentina: string;
  };
};
export function Markets() {
  const uiText = useUiText();
  const { demo } = useApp();
  const [market, setMarket] = useState<(typeof marketCategories)[number]>('Acciones USA');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('default');
  const [favorite, setFavorite] = useState<string | null>(null);
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
  const [key, direction] = sort.split(':');
  const ordering: MarketSort | null =
    sort === 'default'
      ? null
      : { key: key as MarketSortKey, direction: direction as 'asc' | 'desc' };
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return (
    <>
      <SectionTitle
        eyebrow={uiText('MARKET EXPLORER')}
        title={uiText('Un mundo de oportunidades.')}
        description={uiText(
          'Acciones de Estados Unidos y Argentina, CEDEARs, ETFs y criptomonedas. Eleg\u00ED una categor\u00EDa y busc\u00E1 por ticker o nombre.',
        )}
        action={
          <span className="outlined-chip">
            <Globe2 size={14} />
            {uiText(' Cobertura multimercado')}
          </span>
        }
      />
      {uiText(
        data && (
          <div className="catalog-coverage">
            <span>
              <strong>{uiText(data.counts.sp500)}</strong>
              {uiText(' acciones del S&P 500')}
            </span>
            <span>
              <strong>{uiText(data.counts.crypto)}</strong>
              {uiText(' criptomonedas \u00B7 Coin100')}
            </span>
            <span>
              <strong>{uiText(data.counts.etfs)}</strong> ETFs
            </span>
            <span>
              <strong>{uiText(data.counts.cedears)}</strong>
              {uiText(' programas CEDEAR')}
            </span>
            <span>
              <strong>{uiText(data.counts.argentina)}</strong>
              {uiText(' acciones argentinas')}
            </span>
          </div>
        ),
      )}
      <div className="panel markets-panel">
        <div className="market-filters">
          <div className="tabs" role="group" aria-label={uiText('Filtrar mercado')}>
            {uiText(
              marketCategories.map((t) => (
                <button
                  key={t}
                  aria-pressed={market === t}
                  onClick={() => {
                    setMarket(t);
                    setPage(1);
                    setSort('default');
                  }}
                  className={market === t ? 'active' : ''}
                >
                  {uiText(t)}
                </button>
              )),
            )}
          </div>
          <div className="market-search">
            <Search size={16} />
            <input
              value={search}
              aria-label={uiText('Filtrar instrumentos')}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder={uiText(
                market === 'Acciones ARG' ? 'Ticker, nombre o índice...' : 'Ticker o nombre...',
              )}
            />
          </div>
          <select
            aria-label={uiText('Ordenar p\u00E1gina de instrumentos')}
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            <option value="default">
              {uiText(
                market === 'Crypto'
                  ? 'Ranking por capitalización'
                  : market === 'Acciones ARG'
                    ? 'Liquidez · ADTV 40 ruedas'
                    : 'Destacados',
              )}
            </option>
            <option value="change:desc">{uiText('Subas de esta p\u00E1gina')}</option>
            <option value="change:asc">{uiText('Bajas de esta p\u00E1gina')}</option>
            <option value="volume:desc">{uiText('Volumen de esta p\u00E1gina')}</option>
            <option value="volume:asc">{uiText('Volumen ↑')}</option>
            <option value="price:desc">{uiText('Precio ↓')}</option>
            <option value="price:asc">{uiText('Precio ↑')}</option>
            <option value="asset:asc">{uiText('Activo A–Z')}</option>
            <option value="asset:desc">{uiText('Activo Z–A')}</option>
            <option value="rank:asc">{uiText('Ranking ↑')}</option>
            <option value="rank:desc">{uiText('Ranking ↓')}</option>
          </select>
        </div>
        {uiText(
          market === 'Acciones ARG' && data && (
            <div className="table-note" role="note">
              {uiText(data.counts.argentina)}
              {uiText(' acciones locales \u00B7 ')}
              {uiText(data.counts.argentinaMerval)}
              {uiText(
                ' del MSCI Merval. Orden por volumen efectivo promedio de 40 ruedas (ADTV), al',
              )}
              {uiText(' ')}
              {uiText(data.dates.argentina)}: {uiText(data.counts.argentinaRanked)}
              {uiText(
                ' con medici\u00F3n; el resto figura al final, por ticker. Es una medida de liquidez, no de rendimiento esperado.',
              )}
              {uiText(' ')}
              <a
                className="text-link"
                href="https://www.iamc.com.ar/informesanuales/"
                target="_blank"
                rel="noreferrer"
              >
                {uiText('Fuente BYMA')}
              </a>
            </div>
          ),
        )}
        {uiText(
          catalog.isPending || search !== query ? (
            <Skeleton className="table-skeleton" />
          ) : catalog.isError ? (
            <ErrorState message={catalog.error.message} retry={() => catalog.refetch()} />
          ) : rows.length ? (
            <MarketTable
              rows={rows}
              onFavorite={setFavorite}
              sort={ordering}
              onSort={(value) => setSort(`${value.key}:${value.direction}`)}
            />
          ) : (
            <div className="catalog-empty" role="status">
              {uiText('No se encontraron activos. Prob\u00E1 otro ticker o nombre.')}
            </div>
          ),
        )}
        {uiText(
          data && (
            <nav className="catalog-pagination" aria-label={uiText('P\u00E1ginas de activos')}>
              <span>
                {uiText(
                  data.total
                    ? `${(data.page - 1) * data.pageSize + 1}–${Math.min(data.page * data.pageSize, data.total)} de ${data.total.toLocaleString('es-AR')} activos`
                    : '0 activos',
                )}
              </span>
              <div>
                <button
                  className="button button-secondary"
                  disabled={data.page <= 1}
                  onClick={() => setPage(data.page - 1)}
                  aria-label={uiText('P\u00E1gina anterior')}
                >
                  <ChevronLeft size={14} />
                </button>
                <span>
                  {uiText('P\u00E1gina ')}
                  {uiText(data.page)}
                  {uiText(' de ')}
                  {uiText(pages)}
                </span>
                <button
                  className="button button-secondary"
                  disabled={data.page >= pages}
                  onClick={() => setPage(data.page + 1)}
                  aria-label={uiText('P\u00E1gina siguiente')}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </nav>
          ),
        )}
        <div className="table-note">
          {uiText('S&P 500: cartera de acciones publicada por State Street SPY')}
          {uiText(data ? ` · ${data.dates.sp500}` : '')}
          {uiText(
            '. Coin100: top 100 por capitalizaci\u00F3n de CoinGecko, incluidas stablecoins y monedas envueltas',
          )}
          {uiText(data ? ` · ${data.dates.crypto.slice(0, 10)}` : '')}
          {uiText('. CEDEARs: listado BYMA y datos de Caja de Valores')}
          {uiText(data ? ` · ${data.dates.cedears}` : '')}
          {uiText(
            '. Las cotizaciones dependen de la cobertura y cuota de cada fuente; los datos de demostraci\u00F3n se identifican como DEMO.',
          )}
        </div>
      </div>
      {uiText(
        favorite && (
          <WatchlistPicker
            instrumentId={favorite}
            open
            onOpenChange={(open) => {
              if (!open) setFavorite(null);
            }}
          />
        ),
      )}
    </>
  );
}
