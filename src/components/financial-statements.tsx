'use client';
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

const sections: { id: StatementSection; label: string }[] = [
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
        <p>Recuperando presentaciones y períodos fiscales…</p>
      </section>
    );
  if (query.isError)
    return <ErrorState message={query.error.message} retry={() => query.refetch()} />;
  const data = query.data.data;
  if (!data)
    return (
      <EmptyState
        title={
          query.data.reason === 'NOT_APPLICABLE'
            ? 'Este instrumento necesita otra fuente.'
            : 'Estados financieros con trazabilidad.'
        }
        action={
          <a
            className="button button-secondary"
            href="https://www.sec.gov/edgar/search/"
            target="_blank"
            rel="noreferrer"
          >
            Consultar SEC EDGAR <ExternalLink size={14} />
          </a>
        }
      >
        {query.data.error}
      </EmptyState>
    );
  const latest = data.periods[0];
  return (
    <section className="panel statements-panel">
      <div className="statements-heading">
        <div>
          <span className="eyebrow">
            <FileCheck2 size={13} /> SEC EDGAR · US-GAAP
          </span>
          <h2>La evidencia detrás del negocio.</h2>
          <p>
            {data.entityName} · CIK {data.cik}
          </p>
        </div>
        <span className="outlined-chip">Anual · 10-K / 10-K/A</span>
      </div>
      {data.requestedInstrumentId !== data.issuerInstrumentId && (
        <div className="info-strip">
          Estados del emisor subyacente {data.issuerInstrumentId}, expresados en USD. No representan
          el precio del CEDEAR ni se convierten a ARS o por ratio.
        </div>
      )}
      <div className="statements-toolbar">
        <div className="tabs" role="tablist" aria-label="Estado financiero">
          {sections.map((item) => (
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
              {item.label}
            </button>
          ))}
        </div>
        <label>
          Escala
          <select
            aria-label="Escala de estados financieros"
            value={millions ? 'millions' : 'units'}
            onChange={(e) => setMillions(e.target.value === 'millions')}
          >
            <option value="millions">Millones de USD</option>
            <option value="units">USD completos</option>
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
            {sections.find((s) => s.id === section)?.label} anuales. Cada columna usa una única
            presentación fiscal. Las cifras enlazan al documento original.
          </caption>
          <thead>
            <tr>
              <th scope="col">
                Concepto<span>{millions ? 'M USD' : 'USD'} · EPS en USD/acción</span>
              </th>
              {data.periods.map((p) => (
                <th scope="col" key={p.id}>
                  <strong>Cierre {dateLabel(p.end)}</strong>
                  <small>
                    {dateLabel(p.start)} → {dateLabel(p.end)}
                  </small>
                  <a href={p.url} target="_blank" rel="noreferrer">
                    {p.form} · presentado {dateLabel(p.filed)} <ExternalLink size={10} />
                  </a>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows
              .filter((row) => row.section === section)
              .map((row) => (
                <tr key={row.id}>
                  <th scope="row">
                    {row.label}
                    {row.id === 'freeCashFlow' && (
                      <small>Cálculo determinístico; no es una medida US-GAAP.</small>
                    )}
                  </th>
                  {data.periods.map((p) => {
                    const fact = row.values[p.id];
                    return (
                      <td key={p.id} className="numeric">
                        {fact ? (
                          <a
                            className="statement-value"
                            href={p.url}
                            target="_blank"
                            rel="noreferrer"
                            title={`${fact.derived ? 'Calculado: ' : ''}${fact.tags.join(' − ')} · ${p.accession} · ${fact.value} ${fact.unit}`}
                            aria-label={`${row.label}, cierre ${p.end}: ${fact.value} ${fact.unit}. Ver presentación.`}
                          >
                            {displayFact(fact, millions)}
                            {fact.derived && <sup>*</sup>}
                          </a>
                        ) : (
                          <span
                            className="muted"
                            title="Concepto ausente o ambiguo en esta presentación y período exactos"
                          >
                            —
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <div className="statements-method">
        <p>
          <strong>Comparación por ejercicio fiscal.</strong> Se incluyen hasta cinco ejercicios de
          335 a 395 días. No son años calendario ni datos trimestrales o TTM. Cada columna usa el
          10-K o 10-K/A más reciente de su propio ejercicio, sin mezclar versiones.
        </p>
        <p>
          Las etiquetas propias, IFRS, períodos de transición y conceptos ausentes quedan sin valor.
          No se reconstruyen reexpresiones incluidas solamente como comparativos de ejercicios
          posteriores. Esta selección de conceptos no sustituye los estados completos y sus notas.
        </p>
        {data.warnings.length > 0 && (
          <ul>
            {data.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        )}
        <details>
          <summary>Ver trazabilidad y metodología</summary>
          <p>
            La fuente es SEC Company Facts y el directorio de ticker, mercado y CIK. Los valores
            conservan su unidad original; la escala en millones solo cambia la presentación y
            redondea a dos decimales. EPS no se escala. Cada cifra enlaza a su presentación y expone
            la etiqueta XBRL al pasar el cursor. El flujo libre simplificado resta pagos PP&amp;E al
            flujo operativo del mismo período y documento; no incorpora otras inversiones ni se
            aplica a bancos o aseguradoras.
          </p>
          <p>
            {data.delivery === 'imported-snapshot'
              ? 'Archivo SEC importado por el operador'
              : 'Consulta a SEC EDGAR'}{' '}
            · recuperado {dateTimeLabel(data.retrievedAt)}. Último cierre {dateLabel(latest.end)}.
          </p>
          <a href={data.sourceUrl} target="_blank" rel="noreferrer">
            Abrir Company Facts de origen <ExternalLink size={12} />
          </a>
        </details>
      </div>
      <div className="statements-footer">
        <small>— significa que falta evidencia; nunca equivale a cero.</small>
        <Button variant="ghost" disabled={query.isFetching} onClick={() => query.refetch()}>
          <RefreshCw size={12} /> Volver a consultar
        </Button>
      </div>
    </section>
  );
}
