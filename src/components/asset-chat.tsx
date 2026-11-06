'use client';
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUp, Sparkles, ExternalLink, LoaderCircle } from 'lucide-react';
import { useApp } from './app-shell';
import { Button } from './ui';
import { api, dateLabel } from '@/lib/utils';
import type { AssetOverview } from '@/lib/finance/asset-overview';
import { rulesAnswer, type ChatTurn } from '@/lib/ai/asset-chat';

export function AssetChat({ overview }: { overview: AssetOverview }) {
  const { user, demo } = useApp();
  const persistent = Boolean(user) && !demo;
  const qc = useQueryClient();
  const key = ['asset-chat', user?.id, overview.instrument.id, overview.demo];
  const history = useQuery({
    queryKey: key,
    queryFn: () =>
      api<{ turns: ChatTurn[]; hasMore: boolean }>(
        `asset-chat?id=${encodeURIComponent(overview.instrument.id)}${overview.demo ? '&demo=true' : ''}`,
      ),
    enabled: persistent,
    initialData: persistent ? undefined : { turns: [], hasMore: false },
    refetchOnWindowFocus: false,
  });
  const turns = history.data?.turns ?? [];
  const [question, setQuestion] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const log = useRef<HTMLDivElement>(null),
    input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [turns.length]);
  async function send(event: React.FormEvent) {
    event.preventDefault();
    const text = question.trim();
    if (!text || busy || (persistent && !history.data)) return;
    setBusy(true);
    setError('');
    try {
      if (persistent) {
        const turn = await api<ChatTurn>('asset-chat', {
          method: 'POST',
          body: JSON.stringify({
            instrumentId: overview.instrument.id,
            question: text,
            demo: overview.demo,
            baseTurnId: turns.at(-1)?.id ?? null,
          }),
        });
        qc.setQueryData(key, {
          turns: [...turns, turn].slice(-30),
          hasMore: (history.data?.hasMore ?? false) || turns.length >= 30,
        });
      } else {
        const answer = rulesAnswer(overview, text, turns);
        qc.setQueryData(key, {
          turns: [
            ...turns,
            {
              id: crypto.randomUUID(),
              question: text,
              answer,
              createdAt: new Date().toISOString(),
            },
          ].slice(-30),
          hasMore: (history.data?.hasMore ?? false) || turns.length >= 30,
        });
      }
      setQuestion('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar la pregunta.');
      if (persistent) await history.refetch();
    } finally {
      setBusy(false);
      input.current?.focus();
    }
  }
  return (
    <section className="panel asset-chat" id="asset-chat" aria-label="Chat con IA del activo">
      <div className="panel-header">
        <strong>
          <Sparkles size={16} /> Preguntale a Cuantai
        </strong>
        <span className="badge">{overview.instrument.symbol}</span>
      </div>
      <p className="asset-chat-intro">
        Conversá sobre sus rendimientos, fundamentos y riesgos.{' '}
        {persistent
          ? 'Historial privado guardado en tu cuenta.'
          : 'Demo por reglas · historial temporal en esta página.'}
      </p>
      {persistent && history.isPending ? (
        <p role="status" className="asset-chat-intro">
          Cargando conversación…
        </p>
      ) : history.isError ? (
        <div className="asset-chat-intro" role="alert">
          {history.error.message}{' '}
          <Button variant="ghost" onClick={() => history.refetch()}>
            Reintentar historial
          </Button>
        </div>
      ) : null}
      <div
        className="asset-chat-log"
        role="log"
        aria-label="Conversación del activo"
        aria-live="polite"
        ref={log}
        tabIndex={0}
      >
        {history.data?.hasMore && (
          <p className="form-hint">Se muestran los últimos treinta intercambios.</p>
        )}
        {!turns.length && (
          <div className="asset-chat-welcome">
            <span className="eyebrow">TU INVESTIGACIÓN, CON CONTEXTO</span>
            <h3>¿Qué querés entender de este activo?</h3>
            <p>
              Las respuestas identifican sus fuentes y los datos que faltan. La IA requiere una
              conexión configurada; en su ausencia, se informa el modo por reglas.
            </p>
          </div>
        )}
        {turns.map((turn) => (
          <div className="asset-chat-turn" key={turn.id}>
            <div className="asset-chat-question">
              <small>Vos</small>
              <p>{turn.question}</p>
            </div>
            <div className="asset-chat-answer">
              <small>Cuantai · {turn.answer.mode === 'ai' ? 'IA' : 'Reglas'}</small>
              <p>{turn.answer.text}</p>
              {turn.answer.facts.length > 0 && (
                <dl className="chat-facts">
                  {turn.answer.facts.map((fact) => (
                    <div key={fact.id}>
                      <dt>{fact.label}</dt>
                      <dd>
                        {fact.value} {fact.unit}
                      </dd>
                      <small>{dateLabel(fact.asOf)}</small>
                    </div>
                  ))}
                </dl>
              )}
              <small className="chat-notice">{turn.answer.notice}</small>
              <div className="chat-sources">
                {turn.answer.sources.map((source) => (
                  <a key={source.id} href={source.url} target="_blank" rel="noreferrer">
                    {source.title} · {dateLabel(source.asOf)} <ExternalLink size={10} />
                  </a>
                ))}
              </div>
            </div>
          </div>
        ))}
        {busy && (
          <p className="asset-chat-intro" role="status">
            <LoaderCircle size={14} className="spin" /> Revisando la evidencia…
          </p>
        )}
      </div>
      {!turns.length && (
        <div className="asset-chat-prompts">
          {[
            '¿Qué riesgo tiene?',
            'Resumí el análisis técnico',
            '¿Cómo fue su rendimiento semanal?',
          ].map((prompt) => (
            <button
              key={prompt}
              onClick={() => {
                setQuestion(prompt);
                input.current?.focus();
              }}
            >
              {prompt}
            </button>
          ))}
        </div>
      )}
      <form className="asset-chat-form" onSubmit={send}>
        <label className="sr-only" htmlFor="asset-question">
          Pregunta sobre el activo
        </label>
        <textarea
          id="asset-question"
          ref={input}
          placeholder={`Preguntá sobre ${overview.instrument.symbol}…`}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={1000}
          rows={2}
          disabled={busy}
        />
        <Button
          type="submit"
          aria-label="Enviar pregunta"
          disabled={!question.trim() || busy || (persistent && !history.data)}
        >
          <ArrowUp size={18} />
        </Button>
      </form>
      {error && (
        <p className="asset-chat-intro negative" role="alert">
          {error}
        </p>
      )}
      <p className="asset-chat-footer">
        {question.length}/1000 · Información educativa. Sin ejecución de operaciones.
      </p>
    </section>
  );
}
