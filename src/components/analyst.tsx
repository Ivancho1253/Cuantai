'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Sparkles,
  ArrowUpRight,
  ArrowRight,
  Clock3,
  RefreshCw,
  ShieldCheck,
  ExternalLink,
  ChevronRight,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from './app-shell';
import { api, number, dateLabel } from '@/lib/utils';
import { instruments } from '@/lib/market/catalog';
import { demoHistory } from '@/lib/market/demo';
import { deterministicReport, type AnalysisReport } from '@/lib/ai/report';
import { Button, SectionTitle, DataBadge, AssetIcon } from './ui';
export function Analyst({
  instrumentId,
  embedded = false,
}: {
  instrumentId?: string;
  embedded?: boolean;
}) {
  const { user, demo } = useApp();
  const qc = useQueryClient();
  const [selected, setSelected] = useState(instrumentId ?? 'NASDAQ:NVDA:USD');
  const [question, setQuestion] = useState('');
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [busy, setBusy] = useState(false);
  const history = useQuery({
    queryKey: ['analyses'],
    queryFn: () => api<{ id: string; report: AnalysisReport; createdAt: string }[]>('analyses'),
    enabled: Boolean(user) && !demo,
  });
  const instrument = instruments.find((i) => i.id === selected);
  async function analyze() {
    setBusy(true);
    try {
      if (demo || !user) {
        if (!instrument) {
          toast.error('El ejemplo demo usa el catálogo de descubrimiento.');
          return;
        }
        setReport(deterministicReport(demoHistory(instrument)));
        toast.info('Ejemplo técnico determinístico sobre datos sintéticos');
      } else {
        const r = await api<AnalysisReport>('analyses', {
          method: 'POST',
          body: JSON.stringify({ instrumentId: selected, question: question || undefined }),
        });
        setReport(r);
        qc.invalidateQueries({ queryKey: ['analyses'] });
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="analyst-page">
      {!embedded && (
        <SectionTitle
          eyebrow="CUANTAI INTELLIGENCE"
          title="De los datos a una tesis."
          description="Un copiloto para investigar. Evidencia, contexto y preguntas mejores."
          action={
            <span className="outlined-chip">
              <ShieldCheck size={14} /> Análisis con fuentes
            </span>
          }
        />
      )}
      <div className="analyst-layout">
        <div>
          <section className="panel research-input">
            <div className="research-input-heading">
              <span className="ai-icon">
                <Sparkles size={21} />
              </span>
              <div>
                <h2>¿Qué querés entender hoy?</h2>
                <p>Seleccioná un activo para construir una perspectiva informada.</p>
              </div>
            </div>
            <div className="research-controls">
              <div className="research-asset">
                {instrument && <AssetIcon instrument={instrument} />}
                <select
                  aria-label="Activo para analizar"
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                >
                  {!instrument && <option value={selected}>{selected}</option>}
                  {instruments
                    .filter((i) => i.type !== 'cash')
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} · {i.exchange}
                      </option>
                    ))}
                </select>
              </div>
              <Button onClick={analyze} disabled={busy}>
                <Sparkles size={15} />
                {busy ? 'Investigando...' : 'Analizar activo'}
                <ArrowRight size={15} />
              </Button>
            </div>
            <label className="research-question">
              Tu pregunta <span>OPCIONAL</span>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Por ejemplo: ¿qué evidencia sostiene la tendencia y qué podría invalidarla?"
                maxLength={1000}
                rows={2}
              />
            </label>
            <div className="research-steps">
              {['Recuperar evidencia', 'Calcular métricas', 'Contrastar escenarios'].map(
                (step, i) => (
                  <span key={step}>
                    <i>{busy ? <span className="loading-dot" /> : i + 1}</i>
                    {step}
                    {i < 2 && <ChevronRight size={12} />}
                  </span>
                ),
              )}
            </div>
          </section>
          {report ? (
            <ReportView report={report} />
          ) : (
            <section className="research-welcome">
              <div className="research-orbit">
                <Sparkles size={35} />
              </div>
              <div className="eyebrow">PENSÁ CON MÁS CONTEXTO</div>
              <h2>
                Una buena decisión empieza
                <br />
                por una buena pregunta.
              </h2>
              <p>
                El informe reúne métricas calculadas, escenarios e invalidaciones.
                <br />
                Cuando falta evidencia, lo dice.
              </p>
              <div className="research-prompt-grid">
                {[
                  '¿Qué dice el momentum?',
                  '¿Dónde están los riesgos?',
                  '¿Qué debería observar?',
                ].map((q) => (
                  <button key={q} onClick={() => setQuestion(q)}>
                    {q}
                    <ArrowUpRight size={14} />
                  </button>
                ))}
              </div>
              <small>
                {demo || !user
                  ? 'El ejemplo interactivo usa datos demo y un motor determinístico.'
                  : 'La síntesis con IA se habilita al configurar proveedor y modelo. Sin credenciales se genera un reporte técnico determinístico.'}
              </small>
            </section>
          )}
        </div>
        <aside className="research-sidebar">
          <section className="panel">
            <div className="panel-header">
              <strong>
                <Clock3 size={15} /> Historial
              </strong>
            </div>
            {history.data?.length ? (
              <div className="analysis-history">
                {history.data.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => {
                      setReport(h.report);
                      setSelected(h.report.instrumentId);
                    }}
                  >
                    <div>
                      <strong>{h.report.name}</strong>
                      <small>
                        {dateLabel(h.createdAt)} · {h.report.mode === 'ai' ? 'AI' : 'Técnico'}
                      </small>
                    </div>
                    <ChevronRight size={14} />
                  </button>
                ))}
              </div>
            ) : (
              <div className="history-empty">
                <Clock3 size={26} />
                <p>
                  Tus investigaciones,
                  <br />
                  en un solo lugar.
                </p>
                <small>
                  {user
                    ? 'Los informes se guardan al generarlos.'
                    : 'Iniciá sesión para guardar tus análisis.'}
                </small>
              </div>
            )}
          </section>
          <section className="research-principles">
            <span className="eyebrow">EL MÉTODO CUANTAI</span>
            <h3>
              La confianza está
              <br />
              en la evidencia.
            </h3>
            {[
              'Cálculos determinísticos',
              'Fuentes con fecha',
              'Escenarios explícitos',
              'Límites transparentes',
            ].map((t) => (
              <p key={t}>
                <Check size={14} />
                {t}
              </p>
            ))}
            <Link href="/data-policy">
              Cómo trabajamos <ArrowUpRight size={13} />
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
export function ReportView({ report }: { report: AnalysisReport }) {
  const n = report.narrative;
  const m = report.metrics;
  return (
    <article className="analysis-report">
      <div className="report-heading">
        <div>
          <span className="eyebrow">RESEARCH BRIEF</span>
          <h2>{report.name}</h2>
          <small>
            {dateLabel(report.createdAt)} ·{' '}
            {report.mode === 'ai' ? 'Síntesis con IA' : 'Informe técnico determinístico'}
          </small>
        </div>
        <DataBadge status={report.dataStatus} />
      </div>
      <section className="report-summary">
        <Sparkles size={18} />
        <div>
          <span className="eyebrow">RESUMEN EJECUTIVO</span>
          <p>{n.summary}</p>
        </div>
      </section>
      <div className="report-metrics">
        {[
          ['RSI · 14', m?.rsi],
          ['EMA · 20', m?.ema20],
          ['ATR · 14', m?.atr],
          ['MACD · hist.', m?.macd],
        ].map(([label, value]) => (
          <div key={String(label)}>
            <small>{label}</small>
            <strong>{number(value)}</strong>
          </div>
        ))}
      </div>
      <div className="report-block">
        <h3>
          Lectura técnica{' '}
          <span className="outlined-chip">
            {m?.trend === 'uptrend'
              ? 'Tendencia alcista'
              : m?.trend === 'downtrend'
                ? 'Tendencia bajista'
                : m?.trend === 'neutral'
                  ? 'Tendencia neutral'
                  : 'Sin determinar'}
          </span>
        </h3>
        <p>{n.technicalAnalysis}</p>
        <div className="technical-levels">
          <span>
            Mínimo móvil · 20 velas<strong>{number(m?.support)}</strong>
          </span>
          <div />
          <span>
            Máximo móvil · 20 velas<strong>{number(m?.resistance)}</strong>
          </span>
        </div>
        <small>Extremos históricos móviles; no niveles predictivos confirmados.</small>
      </div>
      <div className="report-block">
        <h3>Fundamentales y contexto</h3>
        <p>{n.fundamentalAnalysis}</p>
        <p>{n.macroContext}</p>
      </div>
      <div className="scenario-grid">
        {[
          ['Alcista', n.bullScenario],
          ['Base', n.baseScenario],
          ['Bajista', n.bearScenario],
        ].map(([title, text]) => (
          <div className="scenario" key={title}>
            <span>{title}</span>
            <p>{text}</p>
          </div>
        ))}
      </div>
      <div className="report-block">
        <h3>
          <AlertTriangle size={16} /> Riesgos a considerar
        </h3>
        <ul>
          {n.risks.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>
      <div className="report-block">
        <h3>Qué observar</h3>
        <ul>
          {n.whatToWatch.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <h3>Próximos catalizadores</h3>
        {n.catalysts.length ? (
          n.catalysts.map((c) => <p key={c}>{c}</p>)
        ) : (
          <p>No se verificaron próximos eventos en las fuentes disponibles.</p>
        )}
      </div>
      <section className="report-sources">
        <h3>Fuentes y trazabilidad</h3>
        {report.sources.map((s) => (
          <a
            key={s.id}
            href={s.url || '/data-policy'}
            target={s.url.startsWith('http') ? '_blank' : undefined}
            rel="noreferrer"
          >
            <span>
              <strong>{s.title}</strong>
              <small>
                Dato: {dateLabel(s.asOf)} · Consulta: {dateLabel(s.retrievedAt)}
              </small>
            </span>
            <ExternalLink size={14} />
          </a>
        ))}
      </section>
      <div className="report-limitations">
        <h4>Límites de este análisis</h4>
        {n.limitations.map((l) => (
          <p key={l}>{l}</p>
        ))}
        <p>Investigación educativa. Los escenarios no son garantías ni órdenes de inversión.</p>
      </div>
      <button className="text-link" onClick={() => window.print()}>
        Exportar / imprimir informe <RefreshCw size={13} />
      </button>
    </article>
  );
}
