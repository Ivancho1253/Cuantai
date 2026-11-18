'use client';
import { useText as useUiText } from './locale-provider';
import { useLocale } from './locale-provider';
import { useEffect, useId, useRef, useState } from 'react';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Newspaper, ArrowUpRight, Search, X } from 'lucide-react';
import { useApp } from './app-shell';
import { api, dateLabel } from '@/lib/utils';
import type { Instrument, NewsItem } from '@/lib/market/types';
import { AssetIcon, EmptyState, SectionTitle, ErrorState, Skeleton, Modal } from './ui';
function NewsMedia({ item }: { item: NewsItem }) {
  const uiText = useUiText();
  const [failed, setFailed] = useState(false);
  return (
    <div className="news-media">
      {uiText(
        item.imageUrl && !failed ? (
          <Image
            src={item.imageUrl}
            alt={uiText('')}
            width={720}
            height={420}
            unoptimized
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="news-media-art" aria-label={uiText('Ilustraci\u00F3n de mercados')}>
            <Newspaper size={28} />
            <span>{uiText(item.source)}</span>
          </div>
        ),
      )}
    </div>
  );
}
export function News({
  instrumentId,
  embedded = false,
  compact = false,
  contextual = false,
}: {
  instrumentId?: string;
  embedded?: boolean;
  compact?: boolean;
  contextual?: boolean;
}) {
  const uiText = useUiText();
  const { locale } = useLocale();
  const { demo } = useApp();
  const [search, setSearch] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<Instrument | null>(null);
  const [assetQuery, setAssetQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeResult, setActiveResult] = useState(-1);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsId = useId();
  const selectedId = instrumentId ?? selectedAsset?.id;
  const related = contextual || Boolean(selectedAsset);
  useEffect(() => {
    const timer = setTimeout(() => setAssetQuery(search.trim()), 220);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) setSearchOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);
  const assets = useQuery({
    queryKey: ['news-asset-search', 'issuers', assetQuery],
    queryFn: () =>
      api<{ instruments: Instrument[] }>(
        'instruments?purpose=news&q=' + encodeURIComponent(assetQuery),
      ),
    enabled: !instrumentId && searchOpen && assetQuery.length >= 2,
    staleTime: 60000,
  });
  const normalizeSearch = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  const exactSearch = normalizeSearch(assetQuery);
  const relevance = (asset: Instrument) => {
    if (
      normalizeSearch(asset.symbol) === exactSearch ||
      normalizeSearch(asset.name) === exactSearch ||
      normalizeSearch(asset.providerSymbol ?? '') === exactSearch
    )
      return 0;
    return normalizeSearch(asset.name).startsWith(exactSearch) ? 1 : 2;
  };
  const matches =
    (assetQuery === search.trim() ? assets.data?.instruments : [])
      ?.filter((i) => i.type !== 'cash')
      .sort(
        (a, b) =>
          relevance(a) - relevance(b) ||
          Number(a.type === 'cedear') - Number(b.type === 'cedear') ||
          (a.marketCapRank ?? Infinity) - (b.marketCapRank ?? Infinity),
      )
      .slice(0, 6) ?? [];
  const showMatches = !compact && !instrumentId && searchOpen && search.trim().length >= 2;
  function chooseAsset(asset: Instrument) {
    setSelectedAsset(asset);
    setScope('company');
    setSearch('');
    setSearchOpen(false);
    setVisibleCount(6);
    setActiveResult(-1);
    inputRef.current?.focus();
  }
  function clearAsset() {
    setSelectedAsset(null);
    setScope('company');
    setSearch('');
    setSearchOpen(false);
    setVisibleCount(6);
    inputRef.current?.focus();
  }
  const [article, setArticle] = useState<NewsItem | null>(null);
  const [scope, setScope] = useState<'company' | 'context'>('company');
  const [visibleCount, setVisibleCount] = useState(6);
  const news = useQuery({
    queryKey: ['news', selectedId, demo, scope],
    queryFn: () =>
      api<{
        items: NewsItem[];
        error?: string;
      }>(
        `news?${selectedId ? `id=${encodeURIComponent(selectedId)}&` : ''}${demo ? 'demo=true&' : ''}scope=${scope}`,
      ),
    refetchInterval: 300000,
  });
  const filteredItems =
    news.data?.items.filter((i) =>
      `${i.title} ${i.source}`
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .includes(
          search
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase(),
        ),
    ) ?? [];
  const items = filteredItems.slice(0, compact ? 5 : related ? visibleCount : 30);
  return (
    <>
      {uiText(
        !embedded && (
          <SectionTitle
            eyebrow={uiText('ACTUALIDAD FINANCIERA')}
            title={uiText('La actualidad del mercado.')}
            description={uiText(
              'Noticias con contexto, im\u00E1genes y lectura dentro de Cuantai.',
            )}
          />
        ),
      )}
      <div className={`panel news-container news-editorial${compact ? ' asset-news-compact' : ''}`}>
        <div className="panel-header">
          <strong>
            <Newspaper size={16} />
            {uiText(compact || contextual ? 'Últimas noticias' : 'Noticias del mercado')}
          </strong>
          {!compact && (
            <div
              className="news-search"
              ref={searchRef}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSearchOpen(false);
              }}
            >
              <label className="news-search-field">
                <Search size={18} aria-hidden="true" />
                <input
                  ref={inputRef}
                  aria-label={uiText('Buscar noticias')}
                  role={instrumentId ? undefined : 'combobox'}
                  aria-autocomplete={instrumentId ? undefined : 'list'}
                  aria-expanded={instrumentId ? undefined : showMatches}
                  aria-controls={!instrumentId && showMatches ? resultsId : undefined}
                  aria-activedescendant={
                    showMatches && activeResult >= 0 ? resultsId + '-' + activeResult : undefined
                  }
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setSearchOpen(true);
                    setActiveResult(-1);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setSearchOpen(false);
                      setActiveResult(-1);
                    }
                    if (!showMatches || !matches.length) return;
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setActiveResult((i) => Math.min(i + 1, matches.length - 1));
                    }
                    if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setActiveResult((i) => Math.max(i - 1, 0));
                    }
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      chooseAsset(matches[Math.max(0, activeResult)]);
                    }
                  }}
                  placeholder={uiText(
                    instrumentId ? 'Buscar en estos titulares…' : 'Buscar titulares o activos…',
                  )}
                />
              </label>
              {search && (
                <button
                  type="button"
                  className="news-search-clear"
                  aria-label={uiText('Borrar búsqueda')}
                  onClick={() => {
                    setSearch('');
                    setSearchOpen(false);
                    inputRef.current?.focus();
                  }}
                >
                  <X size={15} />
                </button>
              )}
              {showMatches && (
                <div className="news-asset-suggestions">
                  <div className="news-suggestions-heading">
                    <Search size={14} />
                    {uiText('Ver noticias de un activo')}
                  </div>
                  <div id={resultsId} role="listbox" aria-label={uiText('Activos encontrados')}>
                    {matches.map((asset, index) => (
                      <button
                        type="button"
                        role="option"
                        id={resultsId + '-' + index}
                        aria-selected={index === activeResult}
                        key={asset.id}
                        onClick={() => chooseAsset(asset)}
                      >
                        <AssetIcon instrument={asset} />
                        <span>
                          <strong>{asset.symbol}</strong>
                          <small>{asset.name}</small>
                        </span>
                        <small className="news-suggestion-market">
                          {asset.exchange} · {asset.currency}
                        </small>
                        <ArrowUpRight size={15} />
                      </button>
                    ))}
                  </div>
                  {assets.isError ? (
                    <p role="status">
                      {uiText('No se pudo buscar activos. Podés seguir filtrando titulares.')}
                    </p>
                  ) : assetQuery !== search.trim() || assets.isPending ? (
                    <p role="status">{uiText('Buscando activos…')}</p>
                  ) : !matches.length ? (
                    <p>
                      {uiText(
                        'Sin activos coincidentes. La búsqueda sigue filtrando los titulares.',
                      )}
                    </p>
                  ) : null}
                  <p className="news-suggestions-hint">
                    {uiText(
                      'Elegí un activo para consultar sus noticias. El texto también filtra los titulares actuales.',
                    )}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
        {selectedAsset && (
          <div className="news-selected-asset" role="status">
            <AssetIcon instrument={selectedAsset} small />
            <span>
              <strong>{uiText('Noticias de {0}', [selectedAsset.symbol])}</strong>
              <small>
                {selectedAsset.name} · {selectedAsset.exchange}
              </small>
            </span>
            <button
              type="button"
              onClick={clearAsset}
              aria-label={uiText('Quitar filtro de activo')}
            >
              <X size={16} />
            </button>
          </div>
        )}
        {related && (
          <div className="asset-news-scopes" role="group" aria-label={uiText('Tipo de noticias')}>
            <button
              aria-pressed={scope === 'company'}
              onClick={() => {
                setScope('company');
                setVisibleCount(6);
                setSearch('');
              }}
            >
              {uiText('Sobre la empresa')}
            </button>
            <button
              aria-pressed={scope === 'context'}
              onClick={() => {
                setScope('context');
                setVisibleCount(6);
                setSearch('');
              }}
            >
              {uiText('Sector y mercado')}
            </button>
            <p>
              {uiText(
                scope === 'company'
                  ? 'Titulares que mencionan a la empresa o al activo.'
                  : 'Contexto por sector y temas macroeconómicos; no implica un impacto confirmado.',
              )}
            </p>
          </div>
        )}
        {uiText(
          news.isLoading ? (
            <Skeleton className="table-skeleton" />
          ) : news.isError ? (
            <ErrorState message={news.error.message} retry={() => news.refetch()} />
          ) : items.length ? (
            <div className="news-card-grid">
              {uiText(
                items.map((item) => (
                  <button className="news-card" key={item.id} onClick={() => setArticle(item)}>
                    <NewsMedia item={item} />
                    <div className="news-card-copy">
                      <div className="news-card-meta">
                        <span>{uiText(item.source)}</span>
                        <time dateTime={item.publishedAt}>
                          {uiText(dateLabel(item.publishedAt, locale))}
                        </time>
                      </div>
                      <h2>{uiText(item.title)}</h2>
                      {related && item.relevance && (
                        <span className="news-relevance" title={uiText(item.relevance.reason)}>
                          {uiText(item.relevance.label)}
                        </span>
                      )}
                      {uiText(
                        !compact && item.summary && (
                          <p>
                            {uiText(item.summary.slice(0, 180))}
                            {uiText(item.summary.length > 180 ? '…' : '')}
                          </p>
                        ),
                      )}
                      <span className="news-read-label">
                        {uiText('Leer en Cuantai ')}
                        <ArrowUpRight size={15} />
                      </span>
                    </div>
                  </button>
                )),
              )}
            </div>
          ) : (
            <EmptyState
              title={uiText('Sin titulares para mostrar.')}
              action={
                <button
                  className="button button-secondary"
                  onClick={() => {
                    if (search) {
                      setSearch('');
                      setSearchOpen(false);
                    } else if (selectedAsset) clearAsset();
                    else news.refetch();
                  }}
                >
                  {uiText(
                    search
                      ? 'Limpiar búsqueda'
                      : selectedAsset
                        ? 'Ver noticias del mercado'
                        : 'Reintentar',
                  )}
                </button>
              }
            >
              {uiText(
                news.data?.error ??
                  (search
                    ? 'No hay titulares que coincidan con tu búsqueda.'
                    : 'La fuente no devolvió titulares para este activo.'),
              )}
            </EmptyState>
          ),
        )}
      </div>
      {related && filteredItems.length > items.length && (
        <button
          className="button button-secondary asset-news-more"
          onClick={() => setVisibleCount((count) => count + 6)}
        >
          {uiText('Ver más noticias')}
          <ArrowUpRight size={16} />
        </button>
      )}
      <Modal
        open={Boolean(article)}
        onOpenChange={(open) => {
          if (!open) setArticle(null);
        }}
        title={uiText(article?.title ?? 'Noticia')}
        description={uiText(
          article ? `${article.source} · ${dateLabel(article.publishedAt, locale)}` : '',
        )}
        className="news-reader"
      >
        {uiText(
          article && (
            <>
              <NewsMedia key={article.id} item={article} />
              <div className="news-reader-body">
                <span className="eyebrow">{uiText('LECTURA EN CUANTAI')}</span>
                {uiText(
                  article.summary ? (
                    <p>{uiText(article.summary)}</p>
                  ) : (
                    <p>
                      {uiText(
                        'La fuente comparti\u00F3 este titular sin un resumen ampliado. No agregamos contenido que no haya sido publicado.',
                      )}
                    </p>
                  ),
                )}
                <small>
                  {uiText(
                    'Contenido distribuido por la fuente. El texto disponible puede ser un extracto de la publicaci\u00F3n.',
                  )}
                </small>
                <a
                  className="button button-secondary"
                  href={article.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {uiText('Consultar la publicaci\u00F3n original ')}
                  <ExternalLink size={15} />
                </a>
              </div>
            </>
          ),
        )}
      </Modal>
    </>
  );
}
