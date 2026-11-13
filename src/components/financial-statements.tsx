'use client';
import { useText as useUiText } from './locale-provider';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Decimal from 'decimal.js';
import { ExternalLink, FileCheck2, RefreshCw } from 'lucide-react';
import { useApp } from './app-shell';
import { Button, EmptyState, ErrorState } from './ui';
import { api, dateLabel, dateTimeLabel, formatQuantity } from '@/lib/utils';
import type { Instrument } from '@/lib/market/types';
import type {
  FinancialFact,
  FinancialStatementsResult,
  StatementSection,
} from '@/lib/finance/statements';
const sections: {
  id: StatementSection;
  label: string;
}[] = [
  { id: 'income', label: 'Resultados' },
  { id: 'balance', label: 'Balance' },
  { id: 'cashflow', label: 'Flujo de caja' },
];
function displayFact(fact: FinancialFact, millions: boolean) {
  const value = new Decimal(fact.value);
  return formatQuantity(
    millions && fact.unit === 'USD' ? value.div(1000000).toFixed(2) : value.toFixed(),
  );
}
export function FinancialStatementsPanel({ instrument }: { instrument: Instrument }) {
  const uiText = useUiText();
  const { demo } = useApp();
  const [section, setSection] = useState<StatementSection>('income');
  const [millions, setMillions] = useState(true);
  const query = useQuery({
    queryKey: ['financials', instrument.id, demo],
    queryFn: () =>
      api<FinancialStatementsResult>(
        `financials?id=${encodeURIComponent(instrument.id)}${demo ? '&demo=true' : ''}`,
      ),
    staleTime: 3600000,
  });
  if (query.isPending)
    return (
      <section className="panel statements-loading" aria-busy="true">
        <div className="skeleton" />
        <p>{uiText('Recuperando presentaciones y per\u00EDodos fiscales\u2026')}</p>
      </section>
    );
  if (query.isError)
    return <ErrorState message={query.error.message} retry={() => query.refetch()} />;
  const data = query.data.data;
  if (!data)
    return (
      <EmptyState
        title={uiText(
          query.data.reason === 'NOT_APPLICABLE'
            ? 'Este instrumento necesita otra fuente.'
            : 'Estados financieros con trazabilidad.',
        )}
        action={
          <a
            className="button button-secondary"
            href="https://www.sec.gov/edgar/search/"
            target="_blank"
            rel="noreferrer"
          >
            {uiText('Consultar SEC EDGAR ')}
            <ExternalLink size={14} />
          </a>
        }
      >
        {uiText(query.data.error)}
      </EmptyState>
    );
  const latest = data.periods[0];
  return (
    <section className="panel statements-panel">
      <div className="statements-heading">
        <div>
          <span className="eyebrow">
            <FileCheck2 size={13} />
            {uiText(' SEC EDGAR \u00B7 US-GAAP')}
          </span>
          <h2>{uiText('La evidencia detr\u00E1s del negocio.')}</h2>
          <p>
            {uiText(data.entityName)}
            {uiText(' \u00B7 CIK ')}
            {uiText(data.cik)}
          </p>
        </div>
        <span className="outlined-chip">{uiText('Anual \u00B7 10-K / 10-K/A')}</span>
      </div>
      {uiText(
        data.requestedInstrumentId !== data.issuerInstrumentId && (
          <div className="info-strip">
            {uiText('Estados del emisor subyacente ')}
            {uiText(data.issuerInstrumentId)}
            {uiText(
              ', expresados en USD. No representan el precio del CEDEAR ni se convierten a ARS o por ratio.',
            )}
          </div>
        ),
      )}
      <div className="statements-toolbar">
        <div className="tabs" role="tablist" aria-label={uiText('Estado financiero')}>
          {uiText(
            sections.map((item) => (
              <button
                key={item.id}
                id={`statement-tab-${item.id}`}
                type="button"
                role="tab"
                aria-selected={section === item.id}
                aria-controls="statement-table"
                tabIndex={section === item.id ? 0 : -1}
                className={section === item.id ? 'active' : ''}
                onClick={() => setSection(item.id)}
                onKeyDown={(event) => {
                  const index = sections.findIndex((s) => s.id === item.id);
                  const next =
                    event.key === 'ArrowRight'
                      ? (index + 1) % sections.length
                      : event.key === 'ArrowLeft'
                        ? (index + sections.length - 1) % sections.length
                        : event.key === 'Home'
                          ? 0
                          : event.key === 'End'
                            ? sections.length - 1
                            : null;
                  if (next === null) return;
                  event.preventDefault();
                  setSection(sections[next].id);
                  document.getElementById(`statement-tab-${sections[next].id}`)?.focus();
                }}
              >
                {uiText(item.label)}
              </button>
            )),
          )}
        </div>
        <label>
          {uiText('Escala')}
          <select
            aria-label={uiText('Escala de estados financieros')}
            value={millions ? 'millions' : 'units'}
            onChange={(e) => setMillions(e.target.value === 'millions')}
          >
            <option value="millions">{uiText('Millones de USD')}</option>
            <option value="units">{uiText('USD completos')}</option>
          </select>
        </label>
      </div>
      <div
        className="statements-table-wrap"
        id="statement-table"
        role="tabpanel"
        aria-labelledby={`statement-tab-${section}`}
        tabIndex={0}
      >
        <table className="statements-table">
          <caption>
            {uiText(sections.find((s) => s.id === section)?.label)}
            {uiText(
              ' anuales. Cada columna usa una \u00FAnica presentaci\u00F3n fiscal. Las cifras enlazan al documento original.',
            )}
          </caption>
          <thead>
            <tr>
              <th scope="col">
                {uiText('Concepto')}
                <span>
                  {uiText(millions ? 'M USD' : 'USD')}
                  {uiText(' \u00B7 EPS en USD/acci\u00F3n')}
                </span>
              </th>
              {uiText(
                data.periods.map((p) => (
                  <th scope="col" key={p.id}>
                    <strong>
                      {uiText('Cierre ')}
                      {uiText(dateLabel(p.end))}
                    </strong>
                    <small>
                      {uiText(dateLabel(p.start))} → {uiText(dateLabel(p.end))}
                    </small>
                    <a href={p.url} target="_blank" rel="noreferrer">
                      {uiText(p.form)}
                      {uiText(' \u00B7 presentado ')}
                      {uiText(dateLabel(p.filed))} <ExternalLink size={10} />
                    </a>
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {uiText(
              data.rows
                .filter((row) => row.section === section)
                .map((row) => (
                  <tr key={row.id}>
                    <th scope="row">
                      {uiText(row.label)}
                      {uiText(
                        row.id === 'freeCashFlow' && (
                          <small>
                            {uiText('C\u00E1lculo determin\u00EDstico; no es una medida US-GAAP.')}
                          </small>
                        ),
                      )}
                    </th>
                    {uiText(
                      data.periods.map((p) => {
                        const fact = row.values[p.id];
                        return (
                          <td key={p.id} className="numeric">
                            {uiText(
                              fact ? (
                                <a
                                  className="statement-value"
                                  href={p.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  title={uiText('{0}{1} \u00B7 {2} \u00B7 {3} {4}', [
                                    fact.derived ? 'Calculado: ' : '',
                                    fact.tags.join(' − '),
                                    p.accession,
                                    fact.value,
                                    fact.unit,
                                  ])}
                                  aria-label={uiText(
                                    '{0}, cierre {1}: {2} {3}. Ver presentaci\u00F3n.',
                                    [row.label, p.end, fact.value, fact.unit],
                                  )}
                                >
                                  {uiText(displayFact(fact, millions))}
                                  {uiText(fact.derived && <sup>*</sup>)}
                                </a>
                              ) : (
                                <span
                                  className="muted"
                                  title={uiText(
                                    'Concepto ausente o ambiguo en esta presentaci\u00F3n y per\u00EDodo exactos',
                                  )}
                                >
                                  —
                                </span>
                              ),
                            )}
                          </td>
                        );
                      }),
                    )}
                  </tr>
                )),
            )}
          </tbody>
        </table>
      </div>
      <div className="statements-method">
        <p>
          <strong>{uiText('Comparaci\u00F3n por ejercicio fiscal.')}</strong>
          {uiText(
            ' Se incluyen hasta cinco ejercicios de 335 a 395 d\u00EDas. No son a\u00F1os calendario ni datos trimestrales o TTM. Cada columna usa el 10-K o 10-K/A m\u00E1s reciente de su propio ejercicio, sin mezclar versiones.',
          )}
        </p>
        <p>
          {uiText(
            'Las etiquetas propias, IFRS, per\u00EDodos de transici\u00F3n y conceptos ausentes quedan sin valor. No se reconstruyen reexpresiones incluidas solamente como comparativos de ejercicios posteriores. Esta selecci\u00F3n de conceptos no sustituye los estados completos y sus notas.',
          )}
        </p>
        {uiText(
          data.warnings.length > 0 && (
            <ul>
              {uiText(data.warnings.map((warning) => <li key={warning}>{uiText(warning)}</li>))}
            </ul>
          ),
        )}
        <details>
          <summary>{uiText('Ver trazabilidad y metodolog\u00EDa')}</summary>
          <p>
            {uiText(
              'La fuente es SEC Company Facts y el directorio de ticker, mercado y CIK. Los valores conservan su unidad original; la escala en millones solo cambia la presentaci\u00F3n y redondea a dos decimales. EPS no se escala. Cada cifra enlaza a su presentaci\u00F3n y expone la etiqueta XBRL al pasar el cursor. El flujo libre simplificado resta pagos PP&E al flujo operativo del mismo per\u00EDodo y documento; no incorpora otras inversiones ni se aplica a bancos o aseguradoras.',
            )}
          </p>
          <p>
            {uiText(
              data.delivery === 'imported-snapshot'
                ? 'Archivo SEC importado por el operador'
                : 'Consulta a SEC EDGAR',
            )}
            {uiText(' ')}
            {uiText('\u00B7 recuperado ')}
            {uiText(dateTimeLabel(data.retrievedAt))}
            {uiText('. \u00DAltimo cierre ')}
            {uiText(dateLabel(latest.end))}.
          </p>
          <a href={data.sourceUrl} target="_blank" rel="noreferrer">
            {uiText('Abrir Company Facts de origen ')}
            <ExternalLink size={12} />
          </a>
        </details>
      </div>
      <div className="statements-footer">
        <small>{uiText('\u2014 significa que falta evidencia; nunca equivale a cero.')}</small>
        <Button variant="ghost" disabled={query.isFetching} onClick={() => query.refetch()}>
          <RefreshCw size={12} />
          {uiText(' Volver a consultar')}
        </Button>
      </div>
    </section>
  );
}
