'use client';
import { useLocale, useText as useUiText } from './locale-provider';
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowUp,
  MessageSquare,
  ExternalLink,
  LoaderCircle,
  ArrowUpRight,
  ChartNoAxesCombined,
  Building2,
  ShieldCheck,
  BookOpen,
} from 'lucide-react';
import type { NewsItem } from '@/lib/market/types';
import { useApp } from './app-shell';
import { Button, AssetIcon } from './ui';
import { api, dateLabel } from '@/lib/utils';
import type { AssetOverview } from '@/lib/finance/asset-overview';
import { rulesAnswer, type ChatTurn } from '@/lib/ai/asset-chat';
export function AssetChat({ overview }: { overview: AssetOverview }) {
  const uiText = useUiText();
  const { locale } = useLocale();
  const formatFact = (value: string) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return value;
    return new Intl.NumberFormat(
      locale === 'en' ? 'en-US' : locale === 'pt' ? 'pt-BR' : 'es-AR',
      numeric !== 0 && Math.abs(numeric) < 0.01
        ? { maximumSignificantDigits: 4 }
        : { maximumFractionDigits: 2 },
    ).format(numeric);
  };
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
  const connected = Boolean(status.data?.ai.configured && !overview.demo);
  const prompts = [
    {
      title: 'Leer la tendencia',
      question: 'Resumí el análisis técnico',
      Icon: ChartNoAxesCombined,
    },
    { title: 'Entender el negocio', question: '¿Qué dicen sus fundamentos?', Icon: Building2 },
    { title: 'Medir el riesgo', question: '¿Qué riesgo tiene?', Icon: ShieldCheck },
    { title: 'Interpretar el RSI', question: '¿Qué dice el momentum?', Icon: BookOpen },
  ];
  return (
    <section
      className="panel asset-chat conversation-studio"
      id="asset-chat"
      aria-label={uiText('Chat con IA del activo')}
    >
      <header className="conversation-heading">
        <div className="conversation-identity">
          <AssetIcon instrument={overview.instrument} />
          <div>
            <h3>{uiText('Preguntale a Cuantai')}</h3>
            <p>
              {overview.instrument.symbol} · {overview.instrument.name}
            </p>
          </div>
        </div>
        <span className="conversation-mode" data-connected={connected}>
          {uiText(connected ? 'IA conectada' : 'Lectura por reglas')}
        </span>
      </header>
      <div className="conversation-context">
        <span>
          {uiText(
            persistent
              ? 'Historial privado guardado en tu cuenta.'
              : 'Conversación temporal de demostración.',
          )}
        </span>
        <details>
          <summary>{uiText('Cómo responde')}</summary>
          <p>
            {uiText(
              connected
                ? 'Las respuestas usan los datos del activo y enlazan sus fuentes.'
                : 'Sin IA conectada: las respuestas técnicas se calculan con reglas a partir de los datos disponibles.',
            )}
          </p>
        </details>
      </div>
      {persistent && history.isPending && (
        <p role="status" className="asset-chat-intro">
          {uiText('Cargando conversación…')}
        </p>
      )}
      {history.isError && (
        <div role="alert" className="asset-chat-intro">
          {uiText(history.error.message)}
          <Button variant="ghost" onClick={() => history.refetch()}>
            {uiText('Reintentar historial')}
          </Button>
        </div>
      )}
      <div
        className="asset-chat-log"
        role="log"
        aria-label={uiText('Conversación del activo')}
        aria-live="polite"
        ref={log}
        tabIndex={0}
      >
        {history.data?.hasMore && (
          <p className="form-hint">{uiText('Se muestran los últimos treinta intercambios.')}</p>
        )}
        {!turns.length && (
          <div className="asset-chat-welcome">
            <span className="conversation-welcome-icon">
              <MessageSquare size={28} />
            </span>
            <span className="eyebrow">{uiText('UNA CONVERSACIÓN SOBRE TU ACTIVO')}</span>
            <h3>{uiText('¿Qué querés entender de {0}?', [overview.instrument.symbol])}</h3>
            <p>
              {uiText(
                'De un indicador al negocio completo. Hacé tu pregunta y encontrá una explicación con datos y fuentes.',
              )}
            </p>
          </div>
        )}
        {turns.map((turn) => (
          <article className="asset-chat-turn" key={turn.id}>
            <div className="asset-chat-question">
              <small>{uiText('Vos')}</small>
              <p>{turn.question}</p>
            </div>
            <div className="asset-chat-answer">
              <div className="conversation-answer-heading">
                <span className="conversation-answer-mark">C</span>
                <small>
                  {uiText('Cuantai · ')}
                  {uiText(turn.answer.mode === 'ai' ? 'IA' : 'Reglas')}
                </small>
              </div>
              <p>{uiText(turn.answer.text)}</p>
              {turn.answer.facts.length > 0 && (
                <dl className="chat-facts">
                  {turn.answer.facts.map((fact) => (
                    <div key={fact.id}>
                      <dt>{uiText(fact.label)}</dt>
                      <dd>
                        {formatFact(fact.value)} <span>{fact.unit}</span>
                      </dd>
                      <small>{dateLabel(fact.asOf)}</small>
                    </div>
                  ))}
                </dl>
              )}
              <small className="chat-notice">{uiText(turn.answer.notice)}</small>
              {turn.answer.sources.length > 0 && (
                <details className="conversation-source-list">
                  <summary>
                    {uiText('Consultar fuentes')} <span>{turn.answer.sources.length}</span>
                  </summary>
                  <div className="chat-sources">
                    {turn.answer.sources.map((source) => (
                      <a key={source.id} href={source.url} target="_blank" rel="noreferrer">
                        {source.title} · {dateLabel(source.asOf)}
                        <ExternalLink size={13} />
                      </a>
                    ))}
                  </div>
                </details>
              )}
            </div>
          </article>
        ))}
        {busy && (
          <p className="conversation-loading" role="status">
            <LoaderCircle size={17} className="spin" />
            {uiText('Revisando la evidencia…')}
          </p>
        )}
      </div>
      {!turns.length && (
        <div className="asset-chat-prompts">
          {prompts.map(({ title, question: prompt, Icon }, i) => (
            <button
              type="button"
              key={prompt}
              data-accent={i}
              onClick={() => {
                setQuestion(prompt);
                input.current?.focus();
              }}
            >
              <Icon size={19} />
              <span>{uiText(title)}</span>
              <ArrowUpRight size={15} />
            </button>
          ))}
        </div>
      )}
      <div className="conversation-compose">
        <form className="asset-chat-form" onSubmit={send}>
          <label className="sr-only" htmlFor="asset-question">
            {uiText('Pregunta sobre el activo')}
          </label>
          <textarea
            id="asset-question"
            ref={input}
            placeholder={uiText('Preguntá sobre {0}…', [overview.instrument.symbol])}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            maxLength={1000}
            rows={2}
            disabled={busy}
          />
          <Button
            type="submit"
            aria-label={uiText('Enviar pregunta')}
            disabled={!question.trim() || busy || (persistent && !history.data)}
          >
            {busy ? <LoaderCircle size={20} className="spin" /> : <ArrowUp size={20} />}
          </Button>
        </form>
        {error && (
          <p className="asset-chat-intro negative" role="alert">
            {uiText(error)}
          </p>
        )}
        <p className="asset-chat-footer">
          <span>{uiText('Enter para enviar · Shift + Enter para otra línea')}</span>
          <span>{question.length}/1000</span>
        </p>
      </div>
    </section>
  );
}
