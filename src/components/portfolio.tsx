'use client';
import { useState } from 'react';
import Link from 'next/link';
import { assetHref } from '@/lib/market/asset-href';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowUpRight,
  Plus,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight as ArrowOut,
  Sparkles,
  Coins,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from './app-shell';
import { api, number, formatQuantity, dateLabel, cn } from '@/lib/utils';
import { instruments } from '@/lib/market/catalog';
import type { Instrument, Quote, Currency } from '@/lib/market/types';
import type { Position, Transaction } from '@/lib/finance/portfolio';
import { SectionTitle, Button, Modal, EmptyState, ErrorState, AssetIcon, DataBadge } from './ui';
type PortfolioInfo = { id: string; name: string; baseCurrency: Currency };
type PortfolioDetail = {
  portfolio: PortfolioInfo;
  transactions: Transaction[];
  instruments: Instrument[];
  quotes: Quote[];
  positions: Position[];
  value: string | null;
  costBasis: string | null;
  unrealizedPnl: string | null;
  realizedPnl: string | null;
  dividends: string | null;
  complete: boolean;
  method: string;
  cedearExposures?: {
    instrumentId: string;
    underlyingQuantity: string;
    source: string;
    effectiveFrom: string;
  }[];
};
export function Portfolio() {
  const { user, demo } = useApp();
  const qc = useQueryClient();
  const [previousDay] = useState(() => new Date(Date.now() - 86400000).toISOString().slice(0, 10));
  const [selected, setSelected] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [fxOpen, setFxOpen] = useState(false);
  const [report, setReport] = useState<{
    title: string;
    risks: string[];
    limitations: string[];
    positions: number;
    complete: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const lists = useQuery({
    queryKey: ['portfolios'],
    queryFn: () => api<PortfolioInfo[]>('portfolios'),
    enabled: Boolean(user) && !demo,
  });
  const current = lists.data?.find((p) => p.id === selected) ?? lists.data?.[0];
  const detail = useQuery({
    queryKey: ['portfolio', current?.id],
    queryFn: () => api<PortfolioDetail>(`portfolios?id=${current!.id}`),
    enabled: Boolean(current),
  });
  const data = detail.data;
  async function submit(endpoint: string, payload: unknown, after?: () => void) {
    setBusy(true);
    try {
      const result = await api<PortfolioInfo>(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      qc.invalidateQueries({ queryKey: ['portfolios'] });
      qc.invalidateQueries({ queryKey: ['portfolio'] });
      if (endpoint === 'portfolios') setSelected(result.id);
      after?.();
      toast.success('Guardado en tu cuenta');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function analyze() {
    if (!current) return;
    setBusy(true);
    try {
      setReport(
        await api('portfolio-analysis', {
          method: 'POST',
          body: JSON.stringify({ portfolioId: current.id }),
        }),
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <SectionTitle
        eyebrow="PORTFOLIO INTELLIGENCE"
        title="El valor de ver el conjunto."
        description="Tu patrimonio, sus movimientos y la historia detrás de cada posición."
        action={
          <Button onClick={() => (current ? setTransactionOpen(true) : setCreateOpen(true))}>
            <Plus size={16} />
            {current ? 'Registrar movimiento' : 'Crear cartera'}
          </Button>
        }
      />
      {!user || demo ? (
        <EmptyState
          title="Tu cartera empieza con vos."
          action={
            <Link className="button button-primary" href="/register">
              Crear mi cuenta <ArrowUpRight size={15} />
            </Link>
          }
        >
          Registrá compras, ventas, dividendos y efectivo. Acciones, cripto y CEDEARs, cada uno en
          su moneda. No cargamos posiciones de ejemplo en tu cuenta.
        </EmptyState>
      ) : (
        <>
          {lists.isError && <ErrorState message={lists.error.message} />}
          <div className="portfolio-actions">
            <div className="watchlist-tabs">
              {lists.data?.map((p) => (
                <button
                  className={current?.id === p.id ? 'active' : ''}
                  key={p.id}
                  onClick={() => setSelected(p.id)}
                >
                  <Wallet size={14} />
                  {p.name}
                  <span>{p.baseCurrency}</span>
                </button>
              ))}
              <button aria-label="Nueva cartera" onClick={() => setCreateOpen(true)}>
                <Plus size={16} />
              </button>
            </div>
            {current && (
              <div className="inline-actions">
                <button className="text-link" onClick={() => setQuoteOpen(true)}>
                  Precio manual
                </button>
                <button className="text-link" onClick={() => setFxOpen(true)}>
                  Tipos de cambio
                </button>
                <Button variant="secondary" disabled={busy} onClick={analyze}>
                  <Sparkles size={14} /> Analizar cartera
                </Button>
              </div>
            )}
          </div>
          {!current ? (
            <EmptyState
              title="Una cuenta. Todos tus mercados."
              action={<Button onClick={() => setCreateOpen(true)}>Crear primera cartera</Button>}
            >
              Elegí la moneda base y empezá por tu primera transacción. La metodología implementada
              es FIFO.
            </EmptyState>
          ) : (
            <>
              {detail.isError && (
                <ErrorState message={detail.error.message} retry={() => detail.refetch()} />
              )}
              <div className="portfolio-metrics">
                {[
                  ['Valor actual', data?.value],
                  ['Costo de posiciones', data?.costBasis],
                  ['P&L no realizado', data?.unrealizedPnl],
                  ['P&L realizado', data?.realizedPnl],
                ].map(([label, value], index) => (
                  <div className="panel portfolio-metric" key={label}>
                    <small>{label}</small>
                    <strong
                      className={
                        index > 1 ? (Number(value ?? 0) >= 0 ? 'positive' : 'negative') : ''
                      }
                    >
                      {value == null ? '—' : number(value)} <span>{current.baseCurrency}</span>
                    </strong>
                    <small>
                      {index === 0
                        ? 'Solo posiciones con valoración disponible'
                        : index === 1
                          ? 'Incluye comisiones de compra'
                          : 'Metodología FIFO · neto de comisiones'}
                    </small>
                  </div>
                ))}
              </div>
              {data && !data.complete && (
                <div className="info-strip">
                  Valoración orientativa o incompleta. Revisá las fuentes y los tipos de cambio
                  pendientes en cada posición. No se suman USD y USDT como equivalentes.
                </div>
              )}
              <div className="portfolio-content">
                <section className="panel holdings">
                  <div className="panel-header">
                    <strong>Posiciones</strong>
                    <span className="muted">{data?.positions.length ?? 0} instrumentos</span>
                  </div>
                  {data?.positions.length ? (
                    <div className="table-scroll">
                      <table className="market-table">
                        <thead>
                          <tr>
                            <th>Instrumento</th>
                            <th>Cantidad</th>
                            <th>Valor · {current.baseCurrency}</th>
                            <th>P&L no realizado</th>
                            <th>Fuente / estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.positions.map((p) => {
                            const i = data.instruments.find((i) => i.id === p.instrumentId)!;
                            const q = data.quotes.find((q) => q.instrumentId === p.instrumentId);
                            return (
                              <tr key={p.instrumentId}>
                                <td>
                                  <Link className="asset-cell" href={assetHref(i)}>
                                    <AssetIcon instrument={i} small />
                                    <div>
                                      <strong>{i.symbol}</strong>
                                      <small>
                                        {i.exchange} · {i.currency} · {i.type}
                                      </small>
                                    </div>
                                  </Link>
                                </td>
                                <td className="numeric">
                                  {formatQuantity(p.quantity)}
                                  {data.cedearExposures?.find(
                                    (e) => e.instrumentId === p.instrumentId,
                                  ) && (
                                    <small>
                                      Equiv.{' '}
                                      {formatQuantity(
                                        data.cedearExposures.find(
                                          (e) => e.instrumentId === p.instrumentId,
                                        )!.underlyingQuantity,
                                      )}{' '}
                                      acciones
                                    </small>
                                  )}
                                </td>
                                <td className="numeric">{number(p.value)}</td>
                                <td
                                  className={cn(
                                    'numeric',
                                    Number(p.unrealizedPnl ?? 0) >= 0 ? 'positive' : 'negative',
                                  )}
                                >
                                  {number(p.unrealizedPnl)}
                                </td>
                                <td>
                                  {i.type === 'cash' ? (
                                    <span className="outlined-chip">Saldo en {i.currency}</span>
                                  ) : (
                                    <DataBadge status={q?.status ?? 'unavailable'} />
                                  )}
                                  {p.issues.map((issue) => (
                                    <small className="position-issue" key={issue}>
                                      {issue}
                                    </small>
                                  ))}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <EmptyState
                      title="Agregá tu primera posición."
                      action={
                        <Button variant="secondary" onClick={() => setTransactionOpen(true)}>
                          <Plus size={14} /> Registrar movimiento
                        </Button>
                      }
                    >
                      Seleccioná la especie exacta, su moneda y la fecha de la operación.
                    </EmptyState>
                  )}
                </section>
                <section className="panel allocation-panel">
                  <div className="panel-header">
                    <strong>Composición</strong>
                    <Coins size={15} />
                  </div>
                  {data?.positions.some((p) => p.weight !== null) ? (
                    <>
                      <div className="allocation-bars">
                        {data.positions
                          .filter((p) => Number(p.quantity) > 0)
                          .map((p) => {
                            const i = data.instruments.find((i) => i.id === p.instrumentId)!;
                            return (
                              <div key={p.instrumentId}>
                                <div>
                                  <span>
                                    <i style={{ background: i.color }} />
                                    {i.symbol}
                                  </span>
                                  <strong>{number(p.weight)}%</strong>
                                </div>
                                <div className="allocation-track">
                                  <span
                                    style={{ width: `${p.weight ?? 0}%`, background: i.color }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                      </div>
                      <p className="form-hint">
                        Pesos sobre el valor calculado. Las posiciones de CEDEARs usan el precio por
                        certificado, sin volver a aplicar el ratio.
                      </p>
                    </>
                  ) : (
                    <p className="allocation-empty">
                      La composición aparecerá cuando todas las posiciones tengan precio y
                      conversión a la moneda base.
                    </p>
                  )}
                </section>
              </div>
              <section className="panel transactions-panel">
                <div className="panel-header">
                  <strong>Historial de movimientos</strong>
                  <span className="muted">Registro persistente</span>
                </div>
                <div className="table-scroll">
                  <table className="market-table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Movimiento</th>
                        <th>Instrumento</th>
                        <th>Cantidad</th>
                        <th>Precio unitario</th>
                        <th>Comisiones</th>
                        <th>FX histórico → {current.baseCurrency}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data?.transactions.map((t) => (
                        <tr key={t.id}>
                          <td>{dateLabel(t.date)}</td>
                          <td>
                            <span className={cn('transaction-type', t.type === 'SELL' && 'sell')}>
                              {t.type === 'BUY' ? (
                                <ArrowDownLeft size={13} />
                              ) : (
                                <ArrowOut size={13} />
                              )}{' '}
                              {t.type}
                            </span>
                          </td>
                          <td>{t.instrumentId}</td>
                          <td className="numeric">{formatQuantity(t.quantity)}</td>
                          <td className="numeric">
                            {number(t.price)} {t.currency}
                          </td>
                          <td className="numeric">{number(t.fees)}</td>
                          <td>
                            {t.currency === current.baseCurrency
                              ? 'Misma moneda'
                              : t.fxRate
                                ? `${number(t.fxRate, 6)} · ${t.fxKind}`
                                : 'Pendiente'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="table-note">
                  Compras y ventas no generan movimientos de efectivo automáticamente. Registrá
                  saldos de efectivo por separado para evitar duplicaciones. No incluye TWR/XIRR.
                </div>
              </section>
            </>
          )}
        </>
      )}
      <Modal
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Crear una cartera"
        description="Elegí la moneda en la que querés analizar tu patrimonio."
      >
        {!user || demo ? (
          <Link href="/register" className="button button-primary">
            Crear cuenta
          </Link>
        ) : (
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              submit(
                'portfolios',
                { name: f.get('name'), baseCurrency: f.get('baseCurrency') },
                () => setCreateOpen(false),
              );
            }}
          >
            <label>
              Nombre
              <input name="name" required maxLength={80} placeholder="Mi cartera global" />
            </label>
            <label>
              Moneda base
              <select name="baseCurrency">
                <option>USD</option>
                <option>ARS</option>
                <option>EUR</option>
                <option>USDT</option>
              </select>
            </label>
            <Button type="submit" disabled={busy}>
              Crear cartera
            </Button>
          </form>
        )}
      </Modal>
      <Modal
        open={transactionOpen}
        onOpenChange={setTransactionOpen}
        title="Registrar movimiento"
        description="Una operación registrada no ejecuta ninguna orden en el mercado."
        className="wide-modal"
      >
        {current && (
          <TransactionForm
            portfolio={current}
            busy={busy}
            onSubmit={(body) => submit('transactions', body, () => setTransactionOpen(false))}
          />
        )}
      </Modal>
      <Modal
        open={quoteOpen}
        onOpenChange={setQuoteOpen}
        title="Actualizar precio manual"
        description="Precio por unidad o certificado, en la moneda del instrumento."
      >
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            submit(
              'manual-quotes',
              {
                instrumentId: f.get('instrumentId'),
                price: f.get('price'),
                source: f.get('source'),
                asOf: new Date(String(f.get('asOf'))).toISOString(),
              },
              () => setQuoteOpen(false),
            );
          }}
        >
          <label>
            Instrumento
            <select name="instrumentId">
              {(data?.instruments.length
                ? data.instruments
                : instruments.filter((i) => i.exchange === 'BYMA')
              ).map((i) => (
                <option key={i.id} value={i.id}>
                  {i.symbol} · {i.exchange} · {i.currency}
                </option>
              ))}
            </select>
          </label>
          <div className="form-grid">
            <label>
              Precio por certificado / unidad
              <input name="price" type="number" step="any" min="0.00000001" required />
            </label>
            <label>
              Fecha y hora del precio
              <input
                name="asOf"
                type="datetime-local"
                defaultValue={`${previousDay}T17:00`}
                required
              />
            </label>
          </div>
          <label>
            Fuente
            <input
              name="source"
              required
              minLength={3}
              placeholder="Resumen del broker, cierre autorizado..."
            />
          </label>
          <Button disabled={busy} type="submit">
            Guardar precio manual
          </Button>
        </form>
      </Modal>
      <Modal
        open={fxOpen}
        onOpenChange={setFxOpen}
        title="Conversión actual de moneda"
        description="Ingresá cuántas unidades de moneda destino equivalen a una unidad de origen."
      >
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            submit(
              'exchange-rates',
              {
                from: f.get('from'),
                to: current?.baseCurrency ?? 'USD',
                rate: f.get('rate'),
                kind: f.get('kind'),
                source: f.get('source'),
                asOf: new Date().toISOString(),
              },
              () => setFxOpen(false),
            );
          }}
        >
          <div className="form-grid">
            <label>
              Desde
              <select name="from">
                {['ARS', 'USD', 'USDT', 'EUR']
                  .filter((c) => c !== current?.baseCurrency)
                  .map((c) => (
                    <option key={c}>{c}</option>
                  ))}
              </select>
            </label>
            <label>
              Hacia
              <input value={current?.baseCurrency ?? 'USD'} readOnly />
            </label>
          </div>
          <label>
            Tasa (destino por 1 unidad de origen)
            <input
              name="rate"
              type="number"
              step="any"
              min="0.000000001"
              required
              placeholder="Ej.: 0.0008 USD por ARS"
            />
          </label>
          <label>
            Tipo
            <select name="kind">
              <option>MEP</option>
              <option>CCL</option>
              <option value="official">Oficial</option>
              <option value="spot">Spot</option>
              <option value="manual">Manual</option>
            </select>
          </label>
          <label>
            Fuente
            <input
              name="source"
              required
              minLength={3}
              placeholder="Broker / proveedor / comprobante"
            />
          </label>
          <Button type="submit" disabled={busy}>
            <RefreshCw size={14} /> Guardar tipo de cambio
          </Button>
        </form>
      </Modal>
      <Modal
        open={Boolean(report)}
        onOpenChange={(v) => {
          if (!v) setReport(null);
        }}
        title={report?.title ?? 'Análisis de cartera'}
        description="Diagnóstico determinístico basado en tus posiciones registradas."
      >
        {report && (
          <div className="form-stack">
            <div className="info-strip">
              {report.positions} instrumentos ·{' '}
              {report.complete ? 'Datos completos' : 'Revisar valoración y fuentes'}
            </div>
            {report.risks.length ? (
              report.risks.map((r) => <p key={r}>{r}</p>)
            ) : (
              <p>
                No se activaron las reglas de concentración disponibles. Esto no equivale a una
                evaluación exhaustiva de riesgo.
              </p>
            )}
            <div className="report-limitations">
              {report.limitations.map((r) => (
                <p key={r}>{r}</p>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
function TransactionForm({
  portfolio,
  busy,
  onSubmit,
}: {
  portfolio: PortfolioInfo;
  busy: boolean;
  onSubmit: (data: unknown) => void;
}) {
  const [id, setId] = useState('BYMA:JPM:ARS');
  const instrument = instruments.find((i) => i.id === id)!;
  const crossCurrency = instrument.currency !== portfolio.baseCurrency;
  return (
    <form
      className="form-stack"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        onSubmit({
          portfolioId: portfolio.id,
          instrumentId: id,
          type: f.get('type'),
          quantity: f.get('quantity'),
          price: instrument.type === 'cash' ? '1' : f.get('price'),
          fees: f.get('fees') || '0',
          currency: instrument.currency,
          date: f.get('date'),
          fxRate: crossCurrency && f.get('fxRate') ? f.get('fxRate') : null,
          fxKind: crossCurrency && f.get('fxRate') ? f.get('fxKind') : null,
          fxSource: crossCurrency && f.get('fxRate') ? f.get('fxSource') : null,
          broker: f.get('broker') || null,
          notes: f.get('notes') || null,
        });
      }}
    >
      <label>
        Instrumento exacto
        <select aria-label="Instrumento exacto" value={id} onChange={(e) => setId(e.target.value)}>
          {instruments.map((i) => (
            <option key={i.id} value={i.id}>
              {i.symbol} · {i.exchange} · {i.currency} — {i.name}
            </option>
          ))}
        </select>
      </label>
      {instrument.type === 'cedear' && (
        <div className="info-strip">
          CEDEAR independiente del subyacente. Registrá cantidad de certificados y precio por
          certificado en {instrument.currency}.
        </div>
      )}
      <div className="form-grid">
        <label>
          Operación
          <select name="type">
            {(instrument.type === 'cash'
              ? ['DEPOSIT', 'WITHDRAWAL']
              : ['BUY', 'SELL', 'DIVIDEND', 'SPLIT']
            ).map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label>
          Fecha
          <input
            name="date"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            max={new Date().toISOString().slice(0, 10)}
            required
          />
        </label>
        <label>
          Cantidad / factor de split
          <input
            name="quantity"
            aria-label="Cantidad"
            type="number"
            min="0.000000001"
            step="any"
            required
          />
        </label>
        <label>
          Precio unitario · {instrument.currency}
          <input
            name="price"
            aria-label="Precio unitario"
            type="number"
            min="0"
            step="any"
            defaultValue={instrument.type === 'cash' ? '1' : undefined}
            readOnly={instrument.type === 'cash'}
            required
          />
        </label>
        <label>
          Comisiones · {instrument.currency}
          <input name="fees" type="number" min="0" step="any" defaultValue="0" required />
        </label>
        <label>
          Broker / plataforma
          <input name="broker" maxLength={80} placeholder="Opcional" />
        </label>
      </div>
      {crossCurrency && (
        <fieldset className="fx-fields">
          <legend>
            Conversión histórica · {instrument.currency} → {portfolio.baseCurrency}
          </legend>
          <p>
            El costo en moneda base usa el cambio de la fecha de operación. Si lo dejás vacío, se
            marcará incompleto.
          </p>
          <div className="form-grid">
            <label>
              {portfolio.baseCurrency} por 1 {instrument.currency}
              <input
                name="fxRate"
                type="number"
                min="0.000000001"
                step="any"
                placeholder="Tasa histórica"
              />
            </label>
            <label>
              Tipo
              <select name="fxKind">
                <option>MEP</option>
                <option>CCL</option>
                <option value="spot">Spot</option>
                <option value="official">Oficial</option>
                <option value="manual">Manual</option>
              </select>
            </label>
          </div>
          <label>
            Fuente histórica
            <input name="fxSource" placeholder="Comprobante / broker / proveedor" />
          </label>
        </fieldset>
      )}
      <label>
        Notas
        <input name="notes" maxLength={1000} placeholder="Opcional" />
      </label>
      <p className="form-hint">
        Dividendos: cantidad × importe unitario. Splits: cantidad = factor nuevo/anterior; precio y
        comisiones = 0. Los movimientos se ordenan por fecha y registro.
      </p>
      <Button disabled={busy} type="submit">
        {busy ? 'Guardando...' : 'Registrar movimiento'}
      </Button>
    </form>
  );
}
