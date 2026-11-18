'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, ExternalLink, Scale, Wallet } from 'lucide-react';
import { useLocale, useText } from './locale-provider';
import { Button, ErrorState, Skeleton } from './ui';
import { api } from '@/lib/utils';
import type { Instrument } from '@/lib/market/types';
import { FinancialStatementsPanel } from './financial-statements';
import { useApp } from './app-shell';
import type { FinancialStatementsResult } from '@/lib/finance/statements';
import type { FundamentalResearch } from '@/lib/market/public-fundamentals';

const concepts = [
  ['TotalRevenue', 'Ingresos', 'income'],
  ['GrossProfit', 'Resultado bruto', 'income'],
  ['OperatingIncome', 'Resultado operativo', 'income'],
  ['NetIncome', 'Resultado neto', 'income'],
  ['DilutedEPS', 'Ganancia diluida por acción', 'income'],
  ['TotalAssets', 'Activos totales', 'balance'],
  ['TotalLiabilitiesNetMinorityInterest', 'Pasivos totales', 'balance'],
  ['StockholdersEquity', 'Patrimonio neto', 'balance'],
  ['TotalDebt', 'Deuda total', 'balance'],
  [
    'CashCashEquivalentsAndShortTermInvestments',
    'Efectivo e inversiones de corto plazo',
    'balance',
  ],
  ['OperatingCashFlow', 'Flujo operativo', 'cashflow'],
  ['CapitalExpenditure', 'Inversión en capital', 'cashflow'],
  ['FreeCashFlow', 'Flujo de caja libre', 'cashflow'],
];
export function useFundamentalResearch(id: string) {
  return useQuery({
    queryKey: ['fundamental-research', id],
    queryFn: () => api<FundamentalResearch>('fundamental-research?id=' + encodeURIComponent(id)),
    staleTime: 900000,
  });
}
function useFormat() {
  const { locale } = useLocale();
  return (value: number | undefined, compact = false) =>
    value == null
      ? '—'
      : new Intl.NumberFormat(locale === 'en' ? 'en-US' : locale === 'pt' ? 'pt-BR' : 'es-AR', {
          maximumFractionDigits: 2,
          ...(compact ? { notation: 'compact' as const } : {}),
        }).format(value);
}
export function FundamentalPanel({
  instrument,
  onFinancials,
}: {
  instrument: Instrument;
  onFinancials?: () => void;
}) {
  const t = useText(),
    q = useFundamentalResearch(instrument.id),
    format = useFormat(),
    d = q.data;
  return (
    <section
      className="panel fundamental-research-panel"
      id="asset-fundamental"
      aria-label={t('Conclusión del análisis fundamental')}
    >
      <div className="asset-detail-heading">
        <div>
          <span className="asset-overline">{t('DETRÁS DEL PRECIO')}</span>
          <h2>
            <Building2 size={24} />
            {t('Análisis fundamental')}
          </h2>
        </div>
        {onFinancials && (
          <Button variant="secondary" onClick={onFinancials}>
            {t('Ver estados financieros')} <ExternalLink size={15} />
          </Button>
        )}
      </div>
      {q.isPending ? (
        <Skeleton className="asset-overview-skeleton" />
      ) : q.isError ? (
        <ErrorState message={q.error.message} retry={() => q.refetch()} />
      ) : (
        d && (
          <>
            <h3 className="fundamental-verdict">{t(d.title)}</h3>
            <p className="fundamental-description">{t(d.conclusion)}</p>
            <div className="fundamental-research-metrics">
              {d.metrics.map((m, i) => (
                <article key={m.id} data-accent={i % 4}>
                  <span>{t(m.label)}</span>
                  <strong>
                    {format(m.value, true)} <small>{m.unit}</small>
                  </strong>
                  <p>{t(m.explanation)}</p>
                </article>
              ))}
            </div>
            <details className="asset-methodology">
              <summary>{t('Fuentes y cobertura')}</summary>
              <p>
                {d.issuer} · {d.source} · {d.asOf?.slice(0, 10) ?? t('Sin fecha de reporte')}
              </p>
              {d.coverage.map((c) => (
                <p key={c}>{t(c)}</p>
              ))}
              {d.url && (
                <a href={d.url} target="_blank" rel="noreferrer">
                  {t('Consultar fuente')} ↗
                </a>
              )}
            </details>
          </>
        )
      )}
    </section>
  );
}
export function PublicFinancialStatements({ instrument }: { instrument: Instrument }) {
  const t = useText(),
    q = useFundamentalResearch(instrument.id),
    format = useFormat();
  const { demo } = useApp();
  const sec = useQuery({
    queryKey: ['financials', instrument.id, demo],
    queryFn: () =>
      api<FinancialStatementsResult>(
        'financials?id=' + encodeURIComponent(instrument.id) + (demo ? '&demo=true' : ''),
      ),
    staleTime: 3600000,
  });
  const [section, setSection] = useState('income');
  if (sec.data?.data) return <FinancialStatementsPanel instrument={instrument} />;
  if (q.isPending) return <p role="status">{t('Consultando estados financieros…')}</p>;
  if (q.isError) return <ErrorState message={q.error.message} retry={() => q.refetch()} />;
  const d = q.data;
  if (!d?.periods.length)
    return (
      <>
        <FundamentalPanel instrument={instrument} />
        <p className="fundamental-coverage">
          {t(
            d?.kind === 'crypto'
              ? 'Este activo se analiza por oferta, capitalización y actividad: no publica estados corporativos.'
              : d?.kind === 'etf'
                ? 'El fondo se analiza por composición y patrimonio. Sus informes no equivalen al balance de una empresa.'
                : (d?.error ?? 'La fuente todavía no publicó estados para este emisor.'),
          )}
        </p>
      </>
    );
  return (
    <section className="panel public-statements">
      <span className="asset-overline">{t('ESTADOS FINANCIEROS')}</span>
      <h2>{d.issuer}</h2>
      <p>
        {d.source} · {t('Ejercicios fiscales anuales')}
      </p>
      <div className="tabs" role="tablist" aria-label={t('Estado financiero')}>
        {[
          ['income', 'Resultados'],
          ['balance', 'Balance'],
          ['cashflow', 'Flujo de caja'],
        ].map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={section === id}
            className={section === id ? 'active' : ''}
            onClick={() => setSection(id)}
          >
            {t(label)}
          </button>
        ))}
      </div>
      <div className="public-statements-scroll">
        <table>
          <caption>
            {t(
              'Cifras completas en la moneda de reporte; EPS por acción. — indica una partida ausente.',
            )}
          </caption>
          <thead>
            <tr>
              <th>{t('Concepto')}</th>
              {d.periods.map((p) => (
                <th key={p.date + p.currency}>
                  {p.date}
                  <small>{p.currency}</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {concepts
              .filter((c) => c[2] === section)
              .map(([id, label]) => (
                <tr key={id}>
                  <th>{t(label)}</th>
                  {d.periods.map((p) => (
                    <td key={p.date + p.currency}>{format(p.values[id])}</td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {d.coverage.map((c) => (
        <p className="fundamental-coverage" key={c}>
          {t(c)}
        </p>
      ))}
      <a href={d.url} target="_blank" rel="noreferrer">
        {t('Ver estados en la fuente')} <ExternalLink size={14} />
      </a>
    </section>
  );
}
export function AssetValuation({ instrument }: { instrument: Instrument }) {
  const t = useText(),
    q = useFundamentalResearch(instrument.id),
    format = useFormat();
  const [multiple, setMultiple] = useState('20'),
    [manualEps, setManualEps] = useState(''),
    [price, setPrice] = useState(''),
    [nav, setNav] = useState('');
  const d = q.data,
    eps = d?.metrics.find((m) => m.id === 'eps'),
    value = manualEps !== '' ? Number(manualEps) : eps?.value;
  const valid =
    value != null &&
    value > 0 &&
    Number.isFinite(value) &&
    Number.isFinite(Number(multiple)) &&
    Number(multiple) > 0 &&
    Number(multiple) <= 1000;
  const currency = d?.periods[0]?.currency ?? instrument.currency;
  return (
    <section className="panel asset-valuation">
      <span className="valuation-icon">
        <Scale size={28} />
      </span>
      <span className="asset-overline">{t('PRECIO Y VALOR')}</span>
      <h2>{t('Valuación con supuestos visibles')}</h2>
      {q.isPending ? (
        <p role="status">{t('Consultando fundamentos…')}</p>
      ) : q.isError ? (
        <ErrorState message={q.error.message} retry={() => q.refetch()} />
      ) : d?.kind === 'crypto' ? (
        <>
          <p>
            {t(
              'La capitalización representa la oferta circulante; la valuación diluida incorpora la oferta considerada por la fuente. La diferencia describe dilución, sin atribuir ganancias corporativas al token.',
            )}
          </p>
          <div className="fundamental-research-metrics">
            {d.metrics
              .filter((m) => ['marketCap', 'fdv', 'issued'].includes(m.id))
              .map((m) => (
                <article key={m.id}>
                  <span>{t(m.label)}</span>
                  <strong>
                    {format(m.value, true)} {m.unit}
                  </strong>
                  <p>{t(m.explanation)}</p>
                </article>
              ))}
          </div>
        </>
      ) : d?.kind === 'etf' ? (
        <>
          <p>
            {t(
              'Compará el precio de la cuota con su valor patrimonial (NAV) de la misma fecha y moneda. Un resultado positivo indica prima; negativo, descuento.',
            )}
          </p>
          <div className="valuation-inputs">
            <label>
              {t('Precio por cuota')}
              <input
                aria-label={t('Precio por cuota')}
                type="number"
                min="0"
                step="any"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </label>
            <label>
              {t('NAV por cuota')}
              <input
                aria-label={t('NAV por cuota')}
                type="number"
                min="0"
                step="any"
                value={nav}
                onChange={(e) => setNav(e.target.value)}
              />
            </label>
          </div>
          <output className="valuation-result">
            {Number(nav) > 0 && Number(price) > 0
              ? format((Number(price) / Number(nav) - 1) * 100) + '%'
              : '—'}
            <small>{t('Prima / descuento sobre NAV · datos ingresados por vos')}</small>
          </output>
        </>
      ) : (
        <>
          <p>
            {t(
              'Escenario por múltiplo de ganancias: ganancia anual por acción × P/E elegido. El múltiplo es un supuesto editable, no un promedio sectorial ni un precio objetivo calculado por IA.',
            )}
          </p>
          <div className="valuation-inputs">
            <label>
              {t('Ganancia anual por acción')}
              <input
                aria-label={t('Ganancia anual por acción')}
                type="number"
                step="any"
                placeholder={eps ? String(eps.value) : t('Ingresá EPS verificado')}
                value={manualEps}
                onChange={(e) => setManualEps(e.target.value)}
              />
              <small>
                {eps
                  ? t('Reporte') +
                    ': ' +
                    format(eps.value) +
                    ' ' +
                    eps.unit +
                    ' · ' +
                    d?.asOf?.slice(0, 10)
                  : t('La fuente no informó EPS. Podés ingresarlo desde un balance.')}
              </small>
            </label>
            <label>
              {t('P/E del escenario')}
              <input
                aria-label={t('P/E del escenario')}
                type="number"
                min="0.01"
                max="1000"
                step="any"
                value={multiple}
                onChange={(e) => setMultiple(e.target.value)}
              />
              <small>{t('Supuesto editable · 20× inicial')}</small>
            </label>
          </div>
          <output className="valuation-result">
            {valid ? format(value! * Number(multiple)) + ' ' + currency : '—'}
            <small>{t('Valor por acción del escenario')}</small>
          </output>
          {value != null && value <= 0 && (
            <p>{t('Con ganancias nulas o negativas, el múltiplo P/E no es aplicable.')}</p>
          )}
          {instrument.type === 'cedear' && (
            <p>
              {t(
                'Resultado por acción del subyacente, en su moneda de reporte. Para el certificado hace falta aplicar el ratio vigente y la conversión correspondiente.',
              )}
            </p>
          )}
        </>
      )}
      {d?.url && (
        <a href={d.url} target="_blank" rel="noreferrer">
          <Wallet size={15} />
          {t('Revisar datos de origen')} ↗
        </a>
      )}
    </section>
  );
}
