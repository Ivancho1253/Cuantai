'use client';
import { useText as useUiText } from './locale-provider';
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUp, MessageSquare, ExternalLink, LoaderCircle } from 'lucide-react';
import type { NewsItem } from '@/lib/market/types';
import { useApp } from './app-shell';
import { Button } from './ui';
import { api, dateLabel } from '@/lib/utils';
import type { AssetOverview } from '@/lib/finance/asset-overview';
import { rulesAnswer, type ChatTurn } from '@/lib/ai/asset-chat';
export function AssetChat({ overview }: { overview: AssetOverview }) {
  const uiText = useUiText();
  const { user, demo } = useApp();
  const persistent = Boolean(user) && !demo;
  const qc = useQueryClient();
  const status = useQuery({
    queryKey: ['status'],
    queryFn: () =>
      api<{
        ai: {
          configured: boolean;
        };
      }>('status'),
  });
  const headlines = useQuery({
    queryKey: ['chat-news', overview.instrument.id],
    queryFn: () =>
      api<{
        items: NewsItem[];
        error?: string;
      }>(`news?id=${encodeURIComponent(overview.instrument.id)}`),
    enabled: !persistent,
  });
  const key = ['asset-chat', user?.id, overview.instrument.id, overview.demo];
  const history = useQuery({
    queryKey: key,
    queryFn: () =>
      api<{
        turns: ChatTurn[];
        hasMore: boolean;
      }>(
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
        const news =
          /noticia|titular/i.test(text) && !headlines.data
            ? (await headlines.refetch()).data
            : headlines.data;
        const answer = rulesAnswer(overview, text, turns, news);
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
    <section
      className="panel asset-chat"
      id="asset-chat"
      aria-label={uiText('Chat con IA del activo')}
    >
      <div className="panel-header">
        <strong>
          <MessageSquare size={16} />
          {uiText(' Preguntale a Cuantai')}
        </strong>
        <span className="badge">{uiText(overview.instrument.symbol)}</span>
      </div>
      <p className="asset-chat-intro">
        {uiText('Convers\u00E1 sobre sus rendimientos, fundamentos y riesgos.')}
        {uiText(' ')}
        {uiText(
          persistent
            ? 'Historial privado guardado en tu cuenta.'
            : 'Demo por reglas · historial temporal en esta página.',
        )}
      </p>
      {uiText(
        (!status.data?.ai.configured || overview.demo) && (
          <p className="asset-chat-intro research-data-note">
            {uiText(
              'Sin IA conectada: respuestas t\u00E9cnicas por reglas sobre los datos disponibles. Las preguntas abiertas requieren conectar el proveedor.',
            )}
          </p>
        ),
      )}
      {uiText(
        persistent && history.isPending ? (
          <p role="status" className="asset-chat-intro">
            {uiText('Cargando conversaci\u00F3n\u2026')}
          </p>
        ) : history.isError ? (
          <div className="asset-chat-intro" role="alert">
            {uiText(history.error.message)}
            {uiText(' ')}
            <Button variant="ghost" onClick={() => history.refetch()}>
              {uiText('Reintentar historial')}
            </Button>
          </div>
        ) : null,
      )}
      <div
        className="asset-chat-log"
        role="log"
        aria-label={uiText('Conversaci\u00F3n del activo')}
        aria-live="polite"
        ref={log}
        tabIndex={0}
      >
        {uiText(
          history.data?.hasMore && (
            <p className="form-hint">
              {uiText('Se muestran los \u00FAltimos treinta intercambios.')}
            </p>
          ),
        )}
        {uiText(
          !turns.length && (
            <div className="asset-chat-welcome">
              <span className="eyebrow">{uiText('TU INVESTIGACI\u00D3N, CON CONTEXTO')}</span>
              <h3>{uiText('\u00BFQu\u00E9 quer\u00E9s entender de este activo?')}</h3>
              <p>
                {uiText(
                  'Las respuestas identifican sus fuentes y los datos que faltan. La IA requiere una conexi\u00F3n configurada; en su ausencia, se informa el modo por reglas.',
                )}
              </p>
            </div>
          ),
        )}
        {uiText(
          turns.map((turn) => (
            <div className="asset-chat-turn" key={turn.id}>
              <div className="asset-chat-question">
                <small>{uiText('Vos')}</small>
                <p>{uiText(turn.question)}</p>
              </div>
              <div className="asset-chat-answer">
                <small>
                  {uiText('Cuantai \u00B7 ')}
                  {uiText(turn.answer.mode === 'ai' ? 'IA' : 'Reglas')}
                </small>
                <p>{uiText(turn.answer.text)}</p>
                {uiText(
                  turn.answer.facts.length > 0 && (
                    <dl className="chat-facts">
                      {uiText(
                        turn.answer.facts.map((fact) => (
                          <div key={fact.id}>
                            <dt>{uiText(fact.label)}</dt>
                            <dd>
                              {uiText(fact.value)} {uiText(fact.unit)}
                            </dd>
                            <small>{uiText(dateLabel(fact.asOf))}</small>
                          </div>
                        )),
                      )}
                    </dl>
                  ),
                )}
                <small className="chat-notice">{uiText(turn.answer.notice)}</small>
                <div className="chat-sources">
                  {uiText(
                    turn.answer.sources.map((source) => (
                      <a key={source.id} href={source.url} target="_blank" rel="noreferrer">
                        {uiText(source.title)} · {uiText(dateLabel(source.asOf))}{' '}
                        <ExternalLink size={10} />
                      </a>
                    )),
                  )}
                </div>
              </div>
            </div>
          )),
        )}
        {uiText(
          busy && (
            <p className="asset-chat-intro" role="status">
              <LoaderCircle size={14} className="spin" />
              {uiText(' Revisando la evidencia\u2026')}
            </p>
          ),
        )}
      </div>
      {uiText(
        !turns.length && (
          <div className="asset-chat-prompts">
            {uiText(
              [
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
                  {uiText(prompt)}
                </button>
              )),
            )}
          </div>
        ),
      )}
      <form className="asset-chat-form" onSubmit={send}>
        <label className="sr-only" htmlFor="asset-question">
          {uiText('Pregunta sobre el activo')}
        </label>
        <textarea
          id="asset-question"
          ref={input}
          placeholder={uiText('Pregunt\u00E1 sobre {0}\u2026', [overview.instrument.symbol])}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={1000}
          rows={2}
          disabled={busy}
        />
        <Button
          type="submit"
          aria-label={uiText('Enviar pregunta')}
          disabled={!question.trim() || busy || (persistent && !history.data)}
        >
          <ArrowUp size={18} />
        </Button>
      </form>
      {uiText(
        error && (
          <p className="asset-chat-intro negative" role="alert">
            {uiText(error)}
          </p>
        ),
      )}
      <p className="asset-chat-footer">
        {uiText(question.length)}
        {uiText('/1000 \u00B7 Informaci\u00F3n educativa. Sin ejecuci\u00F3n de operaciones.')}
      </p>
    </section>
  );
}
