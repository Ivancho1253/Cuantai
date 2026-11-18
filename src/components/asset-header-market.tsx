'use client';
import type { TechnicalHorizon } from '@/lib/finance/chart-indicators';
import { useQuery } from '@tanstack/react-query';
import { useApp } from './app-shell';
import { TechnicalGauge } from './technical-gauge';
import { useLocale, useText } from './locale-provider';
import { api, dateLabel } from '@/lib/utils';
import type { AssetOverview } from '@/lib/finance/asset-overview';
import type { Instrument } from '@/lib/market/types';
export function AssetHeaderMarket({
  instrument,
  horizon,
}: {
  instrument: Instrument;
  horizon: TechnicalHorizon;
}) {
  const { demo } = useApp(),
    { locale } = useLocale(),
    t = useText();
  const q = useQuery({
    queryKey: ['asset-overview', instrument.id, demo, 'public'],
    queryFn: () =>
      api<AssetOverview>(
        'asset-overview?id=' +
          encodeURIComponent(instrument.id) +
          '&source=public' +
          (demo ? '&demo=true' : ''),
      ),
    staleTime: 60000,
  });
  const d = q.data;
  const f = (v: number) =>
    new Intl.NumberFormat(locale === 'en' ? 'en-US' : locale === 'pt' ? 'pt-BR' : 'es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(v);
  return (
    <div className="asset-header-market">
      <section className="asset-header-performance" aria-label={t('Rendimiento del activo')}>
        {q.isError && (
          <button className="button button-secondary" onClick={() => q.refetch()}>
            {t('Reintentar resumen')}
          </button>
        )}
        {d?.performance.map((p) => (
          <article
            className="performance-card"
            key={p.id}
            data-sign={p.value == null ? 'none' : p.value >= 0 ? 'positive' : 'negative'}
            title={
              p.value == null
                ? t(p.reason ?? 'Sin historial suficiente')
                : dateLabel(p.from!, locale) + ' → ' + dateLabel(p.to!, locale)
            }
          >
            <span>{t(p.label)}</span>
            <strong className={p.value == null ? '' : p.value >= 0 ? 'positive' : 'negative'}>
              {p.value == null ? '—' : (p.value > 0 ? '+' : '') + f(p.value) + '%'}
            </strong>
          </article>
        ))}
        <small className="header-performance-source">
          {d?.provenance.status === 'demo' ? t('Simulación') : d?.provenance.source} ·{' '}
          {d?.dataAsOf?.slice(0, 10) ?? t('Consultando datos…')}
          {d?.stale ? ' · ' + t('Histórico desactualizado') : ''}
        </small>
      </section>
      <TechnicalGauge instrumentId={instrument.id} horizon={horizon} />
    </div>
  );
}
