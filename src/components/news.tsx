'use client';
import { useText as useUiText } from './locale-provider';
import { useLocale } from './locale-provider';
import { useState } from 'react';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Newspaper, ArrowUpRight, RefreshCw } from 'lucide-react';
import { useApp } from './app-shell';
import { api, dateLabel } from '@/lib/utils';
import type { NewsItem } from '@/lib/market/types';
import { EmptyState, SectionTitle, ErrorState, Skeleton, Modal } from './ui';
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
}: {
  instrumentId?: string;
  embedded?: boolean;
  compact?: boolean;
}) {
  const uiText = useUiText();
  const { locale } = useLocale();
  const { demo } = useApp();
  const [search, setSearch] = useState('');
  const [article, setArticle] = useState<NewsItem | null>(null);
  const news = useQuery({
    queryKey: ['news', instrumentId, demo],
    queryFn: () =>
      api<{
        items: NewsItem[];
        error?: string;
      }>(
        `news?${instrumentId ? `id=${encodeURIComponent(instrumentId)}&` : ''}${demo ? 'demo=true' : ''}`,
      ),
    refetchInterval: 300000,
  });
  const items =
    news.data?.items
      .filter((i) => `${i.title} ${i.source}`.toLowerCase().includes(search.toLowerCase()))
      .slice(0, compact ? 5 : 30) ?? [];
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
            {uiText(compact ? 'Últimas noticias' : 'Noticias del mercado')}
          </strong>
          <button
            className="icon-button"
            aria-label={uiText('Actualizar noticias')}
            disabled={news.isFetching}
            onClick={() => news.refetch()}
          >
            <RefreshCw size={16} />
          </button>
          {uiText(
            !compact && (
              <input
                className="compact-input"
                aria-label={uiText('Buscar noticias')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={uiText('Filtrar titulares...')}
              />
            ),
          )}
        </div>
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
                <button className="button button-secondary" onClick={() => news.refetch()}>
                  {uiText('Actualizar noticias')}
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
