'use client';
import { useText as useUiText } from './locale-provider';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Clock3, ExternalLink, FileText, MessageSquare, RefreshCw } from 'lucide-react';
import { useApp } from './app-shell';
import { api, number, dateLabel } from '@/lib/utils';
import { instruments } from '@/lib/market/catalog';
import { demoHistory } from '@/lib/market/demo';
import type { Instrument, NewsItem } from '@/lib/market/types';
import type { AssetOverview } from '@/lib/finance/asset-overview';
import { deterministicReport, type AnalysisReport } from '@/lib/ai/report';
import { rulesAnswer } from '@/lib/ai/asset-chat';
import { Button, SectionTitle, DataBadge, ErrorState } from './ui';
import { ResearchAssetPicker } from './research-asset-picker';
import { AssetChat } from './asset-chat';
import { News } from './news';
export function Analyst({
  instrumentId,
  initialInstrument,
  embedded = false,
}: {
  instrumentId?: string;
  initialInstrument?: Instrument;
  embedded?: boolean;
}) {
  const uiText = useUiText();
  const { user, demo } = useApp();
  const qc = useQueryClient();
  const [instrument, setInstrument] = useState<Instrument>(
    () => initialInstrument ?? instruments.find((i) => i.id === instrumentId) ?? instruments[0],
  );
  const [tab, setTab] = useState<'report' | 'chat'>('report');
  const [question, setQuestion] = useState('');
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const overview = useQuery({
    queryKey: ['asset-overview', instrument.id, demo],
    queryFn: () =>
      api<AssetOverview>(
        `asset-overview?id=${encodeURIComponent(instrument.id)}${demo ? '&demo=true' : ''}`,
      ),
  });
  const status = useQuery({
    queryKey: ['status'],
    queryFn: () =>
      api<{
        ai: {
          configured: boolean;
        };
      }>('status'),
  });
  const history = useQuery({
    queryKey: ['analyses'],
    queryFn: () =>
      api<
        {
          id: string;
          report: AnalysisReport;
          createdAt: string;
        }[]
      >('analyses'),
    enabled: Boolean(user) && !demo,
  });
  async function analyze() {
    setBusy(true);
    setError('');
    try {
      let result: AnalysisReport;
      if (demo || !user) {
        result = {
          ...deterministicReport(demoHistory(instrument)),
          question: question.trim() || undefined,
        };
        if (question.trim() && overview.data) {
          const headlines = await api<{
            items: NewsItem[];
            error?: string;
          }>(`news?id=${encodeURIComponent(instrument.id)}`);
          result.answer = rulesAnswer(overview.data, question, [], headlines);
        }
      } else {
        result = await api<AnalysisReport>('analyses', {
          method: 'POST',
          body: JSON.stringify({
            instrumentId: instrument.id,
            question: question.trim() || undefined,
          }),
        });
        qc.invalidateQueries({ queryKey: ['analyses'] });
      }
      setReport(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function selectAsset(next: Instrument) {
    setInstrument(next);
    setReport(null);
    setError('');
    setQuestion('');
  }
  async function restoreReport(saved: AnalysisReport) {
    try {
      let item = instruments.find((entry) => entry.id === saved.instrumentId);
      if (!item) {
        const results = await api<{
          instruments: Instrument[];
        }>(`instruments?q=${encodeURIComponent(saved.instrumentId.split(':')[1] ?? saved.name)}`);
        item = results.instruments.find((entry) => entry.id === saved.instrumentId);
      }
      if (!item) throw new Error('El activo de este informe no está disponible en el catálogo.');
      setInstrument(item);
      setReport(saved);
      setQuestion(saved.question ?? '');
      setError('');
      setTab('report');
    } catch (error) {
      setError((error as Error).message);
    }
  }
  return (
    <div className="analyst-page research-desk">
      {uiText(
        !embedded && (
          <SectionTitle
            eyebrow={uiText('MESA DE INVESTIGACI\u00D3N')}
            title={uiText('Investigaci\u00F3n de activos.')}
            description={uiText(
              'Tendencia, escenarios, evidencia y respuestas sobre el activo que est\u00E1s siguiendo.',
            )}
          />
        ),
      )}
      <div className="research-desk-toolbar">
        <ResearchAssetPicker instrument={instrument} onChange={selectAsset} />
        <div className="research-mode" role="status">
          <span className={status.data?.ai.configured && !demo ? 'positive' : ''}>
            {uiText(
              status.data?.ai.configured && !demo ? 'IA conectada' : 'Motor técnico · sin IA',
            )}
          </span>
          <small>
            {uiText(
              !overview.data
                ? 'Preparando datos…'
                : overview.data.demo
                  ? 'Precios de demostración'
                  : 'Evidencia del proveedor',
            )}
          </small>
        </div>
      </div>
      <div
        className="research-view-tabs"
        role="tablist"
        aria-label={uiText('Vista de investigaci\u00F3n')}
      >
        <button
          id="report-tab"
          role="tab"
          aria-controls="research-report-panel"
          aria-selected={tab === 'report'}
          onClick={() => setTab('report')}
        >
          <FileText size={17} />
          {uiText(' Informe del activo')}
        </button>
        <button
          id="chat-tab"
          role="tab"
          aria-controls="research-chat-panel"
          aria-selected={tab === 'chat'}
          onClick={() => setTab('chat')}
        >
          <MessageSquare size={17} />
          {uiText(' Preguntas y respuestas')}
        </button>
      </div>
      <div className="research-desk-grid">
        <div>
          {uiText(
            tab === 'report' ? (
              <div id="research-report-panel" role="tabpanel" aria-labelledby="report-tab">
                {uiText(
                  overview.isError && (
                    <ErrorState message={overview.error.message} retry={() => overview.refetch()} />
                  ),
                )}
                <form
                  className="research-brief-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    analyze();
                  }}
                >
                  <label htmlFor="research-question">
                    {uiText('Enfoque del informe ')}
                    <span>{uiText('Opcional')}</span>
                  </label>
                  <div>
                    <input
                      id="research-question"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      maxLength={1000}
                      placeholder={uiText('Ej.: \u00BFel momentum acompa\u00F1a la tendencia?')}
                    />
                    <Button type="submit" disabled={busy || !overview.data}>
                      {uiText(busy ? 'Preparando informe…' : 'Generar informe')}
                      <ArrowRight size={15} />
                    </Button>
                  </div>
                </form>
                {uiText(error && <ErrorState message={error} retry={analyze} />)}
                {uiText(
                  report ? (
                    <ReportView report={report} />
                  ) : (
                    <section className="research-start">
                      <span className="research-document-label">
                        {uiText(instrument.symbol)}
                        {uiText(' / DOCUMENTO DE TRABAJO')}
                      </span>
                      <h2>{uiText('Un informe que puedas poner a prueba.')}</h2>
                      <p>
                        {uiText(
                          'Compar\u00E1 tendencia, fuerza del movimiento y amplitud del rango. Despu\u00E9s contrast\u00E1 la lectura con escenarios y fuentes.',
                        )}
                      </p>
                      <div className="research-outline">
                        <div>
                          <b>01</b>
                          <strong>{uiText('Se\u00F1ales')}</strong>
                          <span>{uiText('Medias, RSI, MACD y volatilidad.')}</span>
                        </div>
                        <div>
                          <b>02</b>
                          <strong>{uiText('Escenarios')}</strong>
                          <span>
                            {uiText(
                              'Qu\u00E9 deber\u00EDa pasar y qu\u00E9 invalidar\u00EDa la lectura.',
                            )}
                          </span>
                        </div>
                        <div>
                          <b>03</b>
                          <strong>{uiText('Evidencia')}</strong>
                          <span>{uiText('Datos fechados y publicaciones originales.')}</span>
                        </div>
                      </div>
                      <p className="research-availability">
                        {uiText(
                          'Sin clave de IA, el informe y las respuestas t\u00E9cnicas se calculan con reglas. Las consultas abiertas con IA se habilitar\u00E1n cuando conectes el proveedor.',
                        )}
                      </p>
                    </section>
                  ),
                )}
              </div>
            ) : (
              <div id="research-chat-panel" role="tabpanel" aria-labelledby="chat-tab">
                {uiText(
                  overview.isPending ? (
                    <p role="status">{uiText('Preparando evidencia del activo\u2026')}</p>
                  ) : overview.isError ? (
                    <ErrorState message={overview.error.message} retry={() => overview.refetch()} />
                  ) : (
                    overview.data && <AssetChat key={instrument.id} overview={overview.data} />
                  ),
                )}
              </div>
            ),
          )}
        </div>
        <aside className="research-desk-context">
          <section className="research-history">
            <h2>
              <Clock3 size={16} />
              {uiText(' Tus informes')}
            </h2>
            {uiText(
              history.isError ? (
                <ErrorState message={history.error.message} retry={() => history.refetch()} />
              ) : history.data?.length ? (
                history.data.map((h) => (
                  <button key={h.id} onClick={() => restoreReport(h.report)}>
                    <strong>{uiText(h.report.name)}</strong>
                    <small>
                      {uiText(dateLabel(h.createdAt))} ·{' '}
                      {uiText(h.report.mode === 'ai' ? 'IA' : 'Técnico')}
                    </small>
                  </button>
                ))
              ) : (
                <p>
                  {uiText(
                    user
                      ? 'Los informes que generes quedarán guardados acá.'
                      : 'Iniciá sesión para guardar tus investigaciones.',
                  )}
                </p>
              ),
            )}
          </section>
          <News instrumentId={instrument.id} embedded compact />
        </aside>
      </div>
    </div>
  );
}
export function ReportView({ report }: { report: AnalysisReport }) {
  const uiText = useUiText();
  const n = report.narrative;
  const m = report.metrics;
  const trend =
    m?.trend === 'uptrend' ? 'Alcista' : m?.trend === 'downtrend' ? 'Bajista' : 'Neutral';
  const signals = [
    [
      'Tendencia',
      trend,
      m?.ema20 != null && m?.ema50 != null
        ? `EMA 20: ${number(m.ema20)} / EMA 50: ${number(m.ema50)}. La comparación describe la dirección de los cierres.`
        : 'No hay suficientes cierres para comparar medias.',
    ],
    [
      'Momentum',
      m?.rsi != null ? `RSI ${number(m.rsi)}` : 'Sin datos',
      m?.rsi == null
        ? 'No se pudo calcular.'
        : m.rsi >= 70
          ? 'Zona de momentum elevado. Una tendencia fuerte puede sostenerlo; no es una orden de venta.'
          : m.rsi <= 30
            ? 'Momentum débil. Una caída extendida no confirma por sí sola un rebote.'
            : 'Fuera de los extremos convencionales. Contrastá con tendencia y volumen.',
    ],
    [
      'Impulso',
      m?.macd != null ? number(m.macd) : 'Sin datos',
      m?.macd == null
        ? 'Histograma no disponible.'
        : m.macd > 0
          ? 'Histograma MACD positivo: el impulso rápido supera su señal.'
          : m.macd < 0
            ? 'Histograma MACD negativo: el impulso rápido está por debajo de su señal.'
            : 'Sin separación entre el impulso y su señal.',
    ],
    [
      'Amplitud',
      m?.atr != null && m.close > 0 ? `${number((m.atr / m.close) * 100)}%` : 'Sin datos',
      'ATR respecto del último cierre. Mide amplitud histórica del movimiento; no la probabilidad de una pérdida.',
    ],
  ];
  return (
    <article className="analysis-report research-document">
      <header className="research-document-header">
        <div>
          <span className="research-document-label">
            {uiText('INFORME / ')}
            {uiText(report.mode === 'ai' ? 'SÍNTESIS CON IA' : 'LECTURA TÉCNICA')}
          </span>
          <h2>{uiText(report.name)}</h2>
          <p>
            {uiText('Datos al ')}
            {uiText(dateLabel(report.dataAsOf))}
            {uiText(' \u00B7 Generado ')}
            {uiText(dateLabel(report.createdAt))}
          </p>
        </div>
        <DataBadge status={report.dataStatus} />
      </header>
      {uiText(
        report.dataStatus === 'demo' && (
          <p className="research-data-note">
            {uiText(
              'Datos sint\u00E9ticos de demostraci\u00F3n. Estas se\u00F1ales sirven para explorar las herramientas; no describen el mercado actual.',
            )}
          </p>
        ),
      )}
      {uiText(
        report.answer && (
          <section className="research-question-answer">
            <span className="research-document-label">
              {uiText('TU PREGUNTA / ')}
              {uiText(report.answer.mode === 'ai' ? 'IA' : 'RESPUESTA TÉCNICA')}
            </span>
            <h3>{uiText(report.question)}</h3>
            <p>{uiText(report.answer.text)}</p>
            <dl className="chat-facts">
              {uiText(
                report.answer.facts.map((f) => (
                  <div key={f.id}>
                    <dt>{uiText(f.label)}</dt>
                    <dd>
                      {uiText(f.value)} {uiText(f.unit)}
                    </dd>
                    <small>{uiText(dateLabel(f.asOf))}</small>
                  </div>
                )),
              )}
            </dl>
            <small>{uiText(report.answer.notice)}</small>
            {uiText(
              report.answer.sources.map((source) => (
                <a key={source.id} href={source.url} target="_blank" rel="noreferrer">
                  {uiText(source.title)} <ExternalLink size={12} />
                </a>
              )),
            )}
          </section>
        ),
      )}
      <section className="research-conclusion">
        <span className="research-document-label">{uiText('LA LECTURA CENTRAL')}</span>
        <p>{uiText(n.summary)}</p>
      </section>
      <div className="research-price-levels">
        {uiText(
          [
            ['Último cierre', m?.close],
            ['Mínimo · 20 velas', m?.support],
            ['Máximo · 20 velas', m?.resistance],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <small>
                {uiText(label)} · {uiText(report.currency ?? report.instrumentId.split(':').at(-1))}
              </small>
              <strong>{uiText(number(value))}</strong>
            </div>
          )),
        )}
      </div>
      <section className="research-evidence">
        <h3>{uiText('Se\u00F1al por se\u00F1al')}</h3>
        <div className="research-signal-table">
          {uiText(
            signals.map(([label, value, interpretation]) => (
              <div key={label}>
                <span>{uiText(label)}</span>
                <strong>{uiText(value)}</strong>
                <p>{uiText(interpretation)}</p>
              </div>
            )),
          )}
        </div>
        <p>{uiText(n.technicalAnalysis)}</p>
      </section>
      <section className="research-scenarios">
        <h3>{uiText('Tres caminos. Condiciones distintas.')}</h3>
        {uiText(
          [
            [
              'Continuidad alcista',
              n.bullScenario,
              'Perder el mínimo del rango debilitaría esta hipótesis.',
            ],
            ['Consolidación', n.baseScenario, 'Un cierre fuera del rango cambiaría esta lectura.'],
            [
              'Deterioro',
              n.bearScenario,
              'Recuperar el rango y el impulso contradiría el escenario.',
            ],
          ].map(([label, scenario, invalidation], index) => (
            <div key={label}>
              <span>0{uiText(index + 1)}</span>
              <div>
                <h4>{uiText(label)}</h4>
                <p>{uiText(scenario)}</p>
                <small>{uiText(invalidation)}</small>
              </div>
            </div>
          )),
        )}
      </section>
      <div className="research-notes-grid">
        <section>
          <h3>{uiText('Fundamentos')}</h3>
          <p>{uiText(n.fundamentalAnalysis)}</p>
        </section>
        <section>
          <h3>{uiText('Riesgos que faltan contrastar')}</h3>
          <ul>{uiText(n.risks.map((r) => <li key={r}>{uiText(r)}</li>))}</ul>
        </section>
      </div>
      <section className="research-watch">
        <h3>{uiText('Pr\u00F3xima revisi\u00F3n')}</h3>
        <ul>{uiText(n.whatToWatch.map((w) => <li key={w}>{uiText(w)}</li>))}</ul>
        {uiText(n.catalysts.map((c) => <p key={c}>{uiText(c)}</p>))}
      </section>
      <details className="research-source-details">
        <summary>
          {uiText('Fuentes y alcance \u00B7 ')}
          {uiText(report.sources.length)}
          {uiText(' referencias')}
        </summary>
        {uiText(
          report.sources.map((source) => (
            <a
              key={source.id}
              href={source.url || '/data-policy'}
              target={source.url.startsWith('http') ? '_blank' : undefined}
              rel="noreferrer"
            >
              <span>
                {uiText(source.title)}
                <small>
                  {uiText('Dato: ')}
                  {uiText(dateLabel(source.asOf))}
                  {uiText(' \u00B7 Consulta: ')}
                  {uiText(dateLabel(source.retrievedAt))}
                </small>
              </span>
              <ExternalLink size={14} />
            </a>
          )),
        )}
        {uiText(n.limitations.map((l) => <p key={l}>{uiText(l)}</p>))}
      </details>
      <button className="text-link" onClick={() => window.print()}>
        <RefreshCw size={13} />
        {uiText(' Imprimir informe')}
      </button>
    </article>
  );
}
