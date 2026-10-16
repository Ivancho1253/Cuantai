'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Newspaper, ArrowUpRight } from 'lucide-react';
import { useApp } from './app-shell';
import { api, dateLabel } from '@/lib/utils';
import type { NewsItem } from '@/lib/market/types';
import { EmptyState, SectionTitle, ErrorState, Skeleton } from './ui';
export function News({
  instrumentId,
  embedded = false,
}: {
  instrumentId?: string;
  embedded?: boolean;
}) {
  const { demo } = useApp();
  const [search, setSearch] = useState('');
  const news = useQuery({
    queryKey: ['news', instrumentId, demo],
    queryFn: () =>
      api<{ items: NewsItem[]; error?: string }>(
        `news?${instrumentId ? `id=${encodeURIComponent(instrumentId)}&` : ''}${demo ? 'demo=true' : ''}`,
      ),
  });
  const items =
    news.data?.items.filter((i) =>
      `${i.title} ${i.source}`.toLowerCase().includes(search.toLowerCase()),
    ) ?? [];
  return (
    <>
      {!embedded && (
        <SectionTitle
          eyebrow="FINANCIAL INTELLIGENCE"
          title="El contexto también importa."
          description="Titulares con fuente original y fecha. La información antes que el ruido."
        />
      )}
      <div className="panel news-container">
        <div className="panel-header">
          <strong>
            <Newspaper size={16} /> Noticias del mercado
          </strong>
          <input
            className="compact-input"
            aria-label="Buscar noticias"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar titulares..."
          />
        </div>
        {news.isLoading ? (
          <Skeleton className="table-skeleton" />
        ) : news.isError ? (
          <ErrorState message={news.error.message} />
        ) : items.length ? (
          <div className="news-list">
            {items.map((item, index) => (
              <a href={item.url} key={item.id} target="_blank" rel="noreferrer">
                <span className="news-index">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <div className="eyebrow">
                    {item.category} <span>· {item.source}</span>
                  </div>
                  <h2>{item.title}</h2>
                  <small>{dateLabel(item.publishedAt)}</small>
                </div>
                <ArrowUpRight size={21} />
              </a>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Solo noticias que podamos verificar."
            action={
              <a
                className="button button-secondary"
                href="https://www.federalreserve.gov/newsevents.htm"
                target="_blank"
                rel="noreferrer"
              >
                Comunicaciones de la Reserva Federal <ExternalLink size={14} />
              </a>
            }
          >
            {news.data?.error ?? 'No se encontraron noticias para este filtro.'}
          </EmptyState>
        )}
      </div>
      <p className="form-hint">
        Los enlaces abren la publicación original. Cuantai no republica artículos completos ni
        atribuye causalidad a una noticia sin evidencia.
      </p>
    </>
  );
}
