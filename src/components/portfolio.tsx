'use client';
import { useText as useUiText } from './locale-provider';
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
  Upload,
} from 'lucide-react';
import { PortfolioImport } from './portfolio-import';
import { toast } from 'sonner';
import { useApp } from './app-shell';
import { api, number, formatQuantity, dateLabel, cn } from '@/lib/utils';
import { instruments } from '@/lib/market/catalog';
import type { Instrument, Quote, Currency } from '@/lib/market/types';
import type { Position, Transaction } from '@/lib/finance/portfolio';
import { SectionTitle, Button, Modal, EmptyState, ErrorState, AssetIcon, DataBadge } from './ui';
type PortfolioInfo = {
  id: string;
  name: string;
  baseCurrency: Currency;
};
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
  const uiText = useUiText();
  const { user, demo } = useApp();
  const qc = useQueryClient();
  const [previousDay] = useState(() => new Date(Date.now() - 86400000).toISOString().slice(0, 10));
  const [selected, setSelected] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
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
        eyebrow={uiText('PORTFOLIO INTELLIGENCE')}
        title={uiText('El valor de ver el conjunto.')}
        description={uiText(
          'Tu patrimonio, sus movimientos y la historia detr\u00E1s de cada posici\u00F3n.',
        )}
        action={
          <div className="portfolio-primary-actions">
            <Button variant="secondary" onClick={() => setImportOpen(true)}>
              <Upload size={16} />
              {uiText('Importar cartera')}
            </Button>
            <Button onClick={() => (current ? setTransactionOpen(true) : setCreateOpen(true))}>
              <Plus size={16} />
              {uiText(current ? 'Registrar movimiento' : 'Crear cartera')}
            </Button>
          </div>
        }
      />
      {importOpen && (
        <PortfolioImport
          open={importOpen}
          onOpenChange={setImportOpen}
          portfolios={lists.data ?? []}
          selectedId={current?.id}
          onImported={(id) => {
            setSelected(id);
            qc.invalidateQueries({ queryKey: ['portfolios'] });
            qc.invalidateQueries({ queryKey: ['portfolio'] });
          }}
        />
      )}
      {uiText(
        !user || demo ? (
          <EmptyState
            title={uiText('Tu cartera empieza con vos.')}
            action={
              <Link className="button button-primary" href="/register">
                {uiText('Crear mi cuenta ')}
                <ArrowUpRight size={15} />
              </Link>
            }
          >
            {uiText(
              'Registr\u00E1 compras, ventas, dividendos y efectivo. Acciones, cripto y CEDEARs, cada uno en su moneda. No cargamos posiciones de ejemplo en tu cuenta.',
            )}
          </EmptyState>
        ) : (
          <>
            {uiText(lists.isError && <ErrorState message={lists.error.message} />)}
            <div className="portfolio-actions">
              <div className="watchlist-tabs">
                {uiText(
                  lists.data?.map((p) => (
                    <button
                      className={current?.id === p.id ? 'active' : ''}
                      key={p.id}
                      onClick={() => setSelected(p.id)}
                    >
                      <Wallet size={14} />
                      {uiText(p.name)}
                      <span>{uiText(p.baseCurrency)}</span>
                    </button>
                  )),
                )}
                <button aria-label={uiText('Nueva cartera')} onClick={() => setCreateOpen(true)}>
                  <Plus size={16} />
                </button>
              </div>
              {uiText(
                current && (
                  <div className="inline-actions">
                    <button className="text-link" onClick={() => setQuoteOpen(true)}>
                      {uiText('Precio manual')}
                    </button>
                    <button className="text-link" onClick={() => setFxOpen(true)}>
                      {uiText('Tipos de cambio')}
                    </button>
                    <Button variant="secondary" disabled={busy} onClick={analyze}>
                      <Sparkles size={14} />
                      {uiText(' Analizar cartera')}
                    </Button>
                  </div>
                ),
              )}
            </div>
            {uiText(
              !current ? (
                <EmptyState
                  title={uiText('Una cuenta. Todos tus mercados.')}
                  action={
                    <Button onClick={() => setCreateOpen(true)}>
                      {uiText('Crear primera cartera')}
                    </Button>
                  }
                >
                  {uiText(
                    'Eleg\u00ED la moneda base y empez\u00E1 por tu primera transacci\u00F3n. La metodolog\u00EDa implementada es FIFO.',
                  )}
                </EmptyState>
              ) : (
                <>
                  {uiText(
                    detail.isError && (
                      <ErrorState message={detail.error.message} retry={() => detail.refetch()} />
                    ),
                  )}
                  <div className="portfolio-metrics">
                    {uiText(
                      [
                        ['Valor actual', data?.value],
                        ['Costo de posiciones', data?.costBasis],
                        ['P&L no realizado', data?.unrealizedPnl],
                        ['P&L realizado', data?.realizedPnl],
                      ].map(([label, value], index) => (
                        <div className="panel portfolio-metric" key={label}>
                          <small>{uiText(label)}</small>
                          <strong
                            className={
                              index > 1 ? (Number(value ?? 0) >= 0 ? 'positive' : 'negative') : ''
                            }
                          >
                            {uiText(value == null ? '—' : number(value))}{' '}
                            <span>{uiText(current.baseCurrency)}</span>
                          </strong>
                          <small>
                            {uiText(
                              index === 0
                                ? 'Solo posiciones con valoración disponible'
                                : index === 1
                                  ? 'Incluye comisiones de compra'
                                  : 'Metodología FIFO · neto de comisiones',
                            )}
                          </small>
                        </div>
                      )),
                    )}
                  </div>
                  {uiText(
                    data && !data.complete && (
                      <div className="info-strip">
                        {uiText(
                          'Valoraci\u00F3n orientativa o incompleta. Revis\u00E1 las fuentes y los tipos de cambio pendientes en cada posici\u00F3n. No se suman USD y USDT como equivalentes.',
                        )}
                      </div>
                    ),
                  )}
                  <div className="portfolio-content">
                    <section className="panel holdings">
                      <div className="panel-header">
                        <strong>{uiText('Posiciones')}</strong>
                        <span className="muted">
                          {uiText(data?.positions.length ?? 0)}
                          {uiText(' instrumentos')}
                        </span>
                      </div>
                      {uiText(
                        data?.positions.length ? (
                          <div className="table-scroll">
                            <table className="market-table">
                              <thead>
                                <tr>
                                  <th>{uiText('Instrumento')}</th>
                                  <th>{uiText('Cantidad')}</th>
                                  <th>
                                    {uiText('Valor \u00B7 ')}
                                    {uiText(current.baseCurrency)}
                                  </th>
                                  <th>{uiText('P&L no realizado')}</th>
                                  <th>{uiText('Fuente / estado')}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {uiText(
                                  data.positions.map((p) => {
                                    const i = data.instruments.find(
                                      (i) => i.id === p.instrumentId,
                                    )!;
                                    const q = data.quotes.find(
                                      (q) => q.instrumentId === p.instrumentId,
                                    );
                                    return (
                                      <tr key={p.instrumentId}>
                                        <td>
                                          <Link className="asset-cell" href={assetHref(i)}>
                                            <AssetIcon instrument={i} small />
                                            <div>
                                              <strong>{uiText(i.symbol)}</strong>
                                              <small>
                                                {uiText(i.exchange)} · {uiText(i.currency)} ·{' '}
                                                {uiText(i.type)}
                                              </small>
                                            </div>
                                          </Link>
                                        </td>
                                        <td className="numeric">
                                          {uiText(formatQuantity(p.quantity))}
                                          {uiText(
                                            data.cedearExposures?.find(
                                              (e) => e.instrumentId === p.instrumentId,
                                            ) && (
                                              <small>
                                                {uiText('Equiv.')}
                                                {uiText(' ')}
                                                {uiText(
                                                  formatQuantity(
                                                    data.cedearExposures.find(
                                                      (e) => e.instrumentId === p.instrumentId,
                                                    )!.underlyingQuantity,
                                                  ),
                                                )}
                                                {uiText(' ')}
                                                {uiText('acciones')}
                                              </small>
                                            ),
                                          )}
                                        </td>
                                        <td className="numeric">{uiText(number(p.value))}</td>
                                        <td
                                          className={cn(
                                            'numeric',
                                            Number(p.unrealizedPnl ?? 0) >= 0
                                              ? 'positive'
                                              : 'negative',
                                          )}
                                        >
                                          {uiText(number(p.unrealizedPnl))}
                                        </td>
                                        <td>
                                          {uiText(
                                            i.type === 'cash' ? (
                                              <span className="outlined-chip">
                                                {uiText('Saldo en ')}
                                                {uiText(i.currency)}
                                              </span>
                                            ) : (
                                              <DataBadge status={q?.status ?? 'unavailable'} />
                                            ),
                                          )}
                                          {uiText(
                                            p.issues.map((issue) => (
                                              <small className="position-issue" key={issue}>
                                                {uiText(issue)}
                                              </small>
                                            )),
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  }),
                                )}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <EmptyState
                            title={uiText('Agreg\u00E1 tu primera posici\u00F3n.')}
                            action={
                              <Button variant="secondary" onClick={() => setTransactionOpen(true)}>
                                <Plus size={14} />
                                {uiText(' Registrar movimiento')}
                              </Button>
                            }
                          >
                            {uiText(
                              'Seleccion\u00E1 la especie exacta, su moneda y la fecha de la operaci\u00F3n.',
                            )}
                          </EmptyState>
                        ),
                      )}
                    </section>
                    <section className="panel allocation-panel">
                      <div className="panel-header">
                        <strong>{uiText('Composici\u00F3n')}</strong>
                        <Coins size={15} />
                      </div>
                      {uiText(
                        data?.positions.some((p) => p.weight !== null) ? (
                          <>
                            <div className="allocation-bars">
                              {uiText(
                                data.positions
                                  .filter((p) => Number(p.quantity) > 0)
                                  .map((p) => {
                                    const i = data.instruments.find(
                                      (i) => i.id === p.instrumentId,
                                    )!;
                                    return (
                                      <div key={p.instrumentId}>
                                        <div>
                                          <span>
                                            <i style={{ background: i.color }} />
                                            {uiText(i.symbol)}
                                          </span>
                                          <strong>{uiText(number(p.weight))}%</strong>
                                        </div>
                                        <div className="allocation-track">
                                          <span
                                            style={{
                                              width: `${p.weight ?? 0}%`,
                                              background: i.color,
                                            }}
                                          />
                                        </div>
                                      </div>
                                    );
                                  }),
                              )}
                            </div>
                            <p className="form-hint">
                              {uiText(
                                'Pesos sobre el valor calculado. Las posiciones de CEDEARs usan el precio por certificado, sin volver a aplicar el ratio.',
                              )}
                            </p>
                          </>
                        ) : (
                          <p className="allocation-empty">
                            {uiText(
                              'La composici\u00F3n aparecer\u00E1 cuando todas las posiciones tengan precio y conversi\u00F3n a la moneda base.',
                            )}
                          </p>
                        ),
                      )}
                    </section>
                  </div>
                  <section className="panel transactions-panel">
                    <div className="panel-header">
                      <strong>{uiText('Historial de movimientos')}</strong>
                      <span className="muted">{uiText('Registro persistente')}</span>
                    </div>
                    <div className="table-scroll">
                      <table className="market-table">
                        <thead>
                          <tr>
                            <th>{uiText('Fecha')}</th>
                            <th>{uiText('Movimiento')}</th>
                            <th>{uiText('Instrumento')}</th>
                            <th>{uiText('Cantidad')}</th>
                            <th>{uiText('Precio unitario')}</th>
                            <th>{uiText('Comisiones')}</th>
                            <th>
                              {uiText('FX hist\u00F3rico \u2192 ')}
                              {uiText(current.baseCurrency)}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {uiText(
                            data?.transactions.map((t) => (
                              <tr key={t.id}>
                                <td>{uiText(dateLabel(t.date))}</td>
                                <td>
                                  <span
                                    className={cn('transaction-type', t.type === 'SELL' && 'sell')}
                                  >
                                    {uiText(
                                      t.type === 'BUY' ? (
                                        <ArrowDownLeft size={13} />
                                      ) : (
                                        <ArrowOut size={13} />
                                      ),
                                    )}
                                    {uiText(' ')}
                                    {uiText(
                                      {
                                        BUY: 'Compra',
                                        SELL: 'Venta',
                                        DIVIDEND: 'Dividendo',
                                        DEPOSIT: 'Depósito',
                                        WITHDRAWAL: 'Retiro',
                                        SPLIT: 'Split',
                                        TRANSFER_IN: 'Ajuste de entrada',
                                        TRANSFER_OUT: 'Ajuste de salida',
                                      }[t.type],
                                    )}
                                  </span>
                                </td>
                                <td>{uiText(t.instrumentId)}</td>
                                <td className="numeric">{uiText(formatQuantity(t.quantity))}</td>
                                <td className="numeric">
                                  {uiText(number(t.price))} {uiText(t.currency)}
                                </td>
                                <td className="numeric">{uiText(number(t.fees))}</td>
                                <td>
                                  {uiText(
                                    t.currency === current.baseCurrency
                                      ? 'Misma moneda'
                                      : t.fxRate
                                        ? `${number(t.fxRate, 6)} · ${t.fxKind}`
                                        : 'Pendiente',
                                  )}
                                </td>
                              </tr>
                            )),
                          )}
                        </tbody>
                      </table>
                    </div>
                    <div className="table-note">
                      {uiText(
                        'Compras y ventas no generan movimientos de efectivo autom\u00E1ticamente. Registr\u00E1 saldos de efectivo por separado para evitar duplicaciones. No incluye TWR/XIRR.',
                      )}
                    </div>
                  </section>
                </>
              ),
            )}
          </>
        ),
      )}
      <Modal
        open={createOpen}
        onOpenChange={setCreateOpen}
        title={uiText('Crear una cartera')}
        description={uiText('Eleg\u00ED la moneda en la que quer\u00E9s analizar tu patrimonio.')}
      >
        {uiText(
          !user || demo ? (
            <Link href="/register" className="button button-primary">
              {uiText('Crear cuenta')}
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
                {uiText('Nombre')}
                <input
                  name="name"
                  required
                  maxLength={80}
                  placeholder={uiText('Mi cartera global')}
                />
              </label>
              <label>
                {uiText('Moneda base')}
                <select name="baseCurrency">
                  <option>{uiText('USD')}</option>
                  <option>{uiText('ARS')}</option>
                  <option>{uiText('EUR')}</option>
                  <option>{uiText('USDT')}</option>
                </select>
              </label>
              <Button type="submit" disabled={busy}>
                {uiText('Crear cartera')}
              </Button>
            </form>
          ),
        )}
      </Modal>
      <Modal
        open={transactionOpen}
        onOpenChange={setTransactionOpen}
        title={uiText('Registrar movimiento')}
        description={uiText(
          'Una operaci\u00F3n registrada no ejecuta ninguna orden en el mercado.',
        )}
        className="wide-modal"
      >
        {uiText(
          current && (
            <TransactionForm
              portfolio={current}
              busy={busy}
              onSubmit={(body) => submit('transactions', body, () => setTransactionOpen(false))}
            />
          ),
        )}
      </Modal>
      <Modal
        open={quoteOpen}
        onOpenChange={setQuoteOpen}
        title={uiText('Actualizar precio manual')}
        description={uiText('Precio por unidad o certificado, en la moneda del instrumento.')}
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
            {uiText('Instrumento')}
            <select name="instrumentId">
              {uiText(
                (data?.instruments.length
                  ? data.instruments
                  : instruments.filter((i) => i.exchange === 'BYMA')
                ).map((i) => (
                  <option key={i.id} value={i.id}>
                    {uiText(i.symbol)} · {uiText(i.exchange)} · {uiText(i.currency)}
                  </option>
                )),
              )}
            </select>
          </label>
          <div className="form-grid">
            <label>
              {uiText('Precio por certificado / unidad')}
              <input name="price" type="number" step="any" min="0.00000001" required />
            </label>
            <label>
              {uiText('Fecha y hora del precio')}
              <input
                name="asOf"
                type="datetime-local"
                defaultValue={`${previousDay}T17:00`}
                required
              />
            </label>
          </div>
          <label>
            {uiText('Fuente')}
            <input
              name="source"
              required
              minLength={3}
              placeholder={uiText('Resumen del broker, cierre autorizado...')}
            />
          </label>
          <Button disabled={busy} type="submit">
            {uiText('Guardar precio manual')}
          </Button>
        </form>
      </Modal>
      <Modal
        open={fxOpen}
        onOpenChange={setFxOpen}
        title={uiText('Conversi\u00F3n actual de moneda')}
        description={uiText(
          'Ingres\u00E1 cu\u00E1ntas unidades de moneda destino equivalen a una unidad de origen.',
        )}
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
              {uiText('Desde')}
              <select name="from">
                {uiText(
                  ['ARS', 'USD', 'USDT', 'EUR']
                    .filter((c) => c !== current?.baseCurrency)
                    .map((c) => <option key={c}>{uiText(c)}</option>),
                )}
              </select>
            </label>
            <label>
              {uiText('Hacia')}
              <input value={current?.baseCurrency ?? 'USD'} readOnly />
            </label>
          </div>
          <label>
            {uiText('Tasa (destino por 1 unidad de origen)')}
            <input
              name="rate"
              type="number"
              step="any"
              min="0.000000001"
              required
              placeholder={uiText('Ej.: 0.0008 USD por ARS')}
            />
          </label>
          <label>
            {uiText('Tipo')}
            <select name="kind">
              <option>{uiText('MEP')}</option>
              <option>{uiText('CCL')}</option>
              <option value="official">{uiText('Oficial')}</option>
              <option value="spot">{uiText('Spot')}</option>
              <option value="manual">{uiText('Manual')}</option>
            </select>
          </label>
          <label>
            {uiText('Fuente')}
            <input
              name="source"
              required
              minLength={3}
              placeholder={uiText('Broker / proveedor / comprobante')}
            />
          </label>
          <Button type="submit" disabled={busy}>
            <RefreshCw size={14} />
            {uiText(' Guardar tipo de cambio')}
          </Button>
        </form>
      </Modal>
      <Modal
        open={Boolean(report)}
        onOpenChange={(v) => {
          if (!v) setReport(null);
        }}
        title={uiText(report?.title ?? 'Análisis de cartera')}
        description={uiText(
          'Diagn\u00F3stico determin\u00EDstico basado en tus posiciones registradas.',
        )}
      >
        {uiText(
          report && (
            <div className="form-stack">
              <div className="info-strip">
                {uiText(report.positions)}
                {uiText(' instrumentos \u00B7')}
                {uiText(' ')}
                {uiText(report.complete ? 'Datos completos' : 'Revisar valoración y fuentes')}
              </div>
              {uiText(
                report.risks.length ? (
                  report.risks.map((r) => <p key={r}>{uiText(r)}</p>)
                ) : (
                  <p>
                    {uiText(
                      'No se activaron las reglas de concentraci\u00F3n disponibles. Esto no equivale a una evaluaci\u00F3n exhaustiva de riesgo.',
                    )}
                  </p>
                ),
              )}
              <div className="report-limitations">
                {uiText(report.limitations.map((r) => <p key={r}>{uiText(r)}</p>))}
              </div>
            </div>
          ),
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
  const uiText = useUiText();
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
        {uiText('Instrumento exacto')}
        <select
          aria-label={uiText('Instrumento exacto')}
          value={id}
          onChange={(e) => setId(e.target.value)}
        >
          {uiText(
            instruments.map((i) => (
              <option key={i.id} value={i.id}>
                {uiText(i.symbol)} · {uiText(i.exchange)} · {uiText(i.currency)} — {uiText(i.name)}
              </option>
            )),
          )}
        </select>
      </label>
      {uiText(
        instrument.type === 'cedear' && (
          <div className="info-strip">
            {uiText(
              'CEDEAR independiente del subyacente. Registr\u00E1 cantidad de certificados y precio por certificado en ',
            )}
            {uiText(instrument.currency)}.
          </div>
        ),
      )}
      <div className="form-grid">
        <label>
          {uiText('Operaci\u00F3n')}
          <select name="type">
            {uiText(
              (instrument.type === 'cash'
                ? ['DEPOSIT', 'WITHDRAWAL']
                : ['BUY', 'SELL', 'DIVIDEND', 'SPLIT']
              ).map((t) => <option key={t}>{uiText(t)}</option>),
            )}
          </select>
        </label>
        <label>
          {uiText('Fecha')}
          <input
            name="date"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            max={new Date().toISOString().slice(0, 10)}
            required
          />
        </label>
        <label>
          {uiText('Cantidad / factor de split')}
          <input
            name="quantity"
            aria-label={uiText('Cantidad')}
            type="number"
            min="0.000000001"
            step="any"
            required
          />
        </label>
        <label>
          {uiText('Precio unitario \u00B7 ')}
          {uiText(instrument.currency)}
          <input
            name="price"
            aria-label={uiText('Precio unitario')}
            type="number"
            min="0"
            step="any"
            defaultValue={instrument.type === 'cash' ? '1' : undefined}
            readOnly={instrument.type === 'cash'}
            required
          />
        </label>
        <label>
          {uiText('Comisiones \u00B7 ')}
          {uiText(instrument.currency)}
          <input name="fees" type="number" min="0" step="any" defaultValue="0" required />
        </label>
        <label>
          {uiText('Broker / plataforma')}
          <input name="broker" maxLength={80} placeholder={uiText('Opcional')} />
        </label>
      </div>
      {uiText(
        crossCurrency && (
          <fieldset className="fx-fields">
            <legend>
              {uiText('Conversi\u00F3n hist\u00F3rica \u00B7 ')}
              {uiText(instrument.currency)} → {uiText(portfolio.baseCurrency)}
            </legend>
            <p>
              {uiText(
                'El costo en moneda base usa el cambio de la fecha de operaci\u00F3n. Si lo dej\u00E1s vac\u00EDo, se marcar\u00E1 incompleto.',
              )}
            </p>
            <div className="form-grid">
              <label>
                {uiText(portfolio.baseCurrency)}
                {uiText(' por 1 ')}
                {uiText(instrument.currency)}
                <input
                  name="fxRate"
                  type="number"
                  min="0.000000001"
                  step="any"
                  placeholder={uiText('Tasa hist\u00F3rica')}
                />
              </label>
              <label>
                {uiText('Tipo')}
                <select name="fxKind">
                  <option>{uiText('MEP')}</option>
                  <option>{uiText('CCL')}</option>
                  <option value="spot">{uiText('Spot')}</option>
                  <option value="official">{uiText('Oficial')}</option>
                  <option value="manual">{uiText('Manual')}</option>
                </select>
              </label>
            </div>
            <label>
              {uiText('Fuente hist\u00F3rica')}
              <input name="fxSource" placeholder={uiText('Comprobante / broker / proveedor')} />
            </label>
          </fieldset>
        ),
      )}
      <label>
        {uiText('Notas')}
        <input name="notes" maxLength={1000} placeholder={uiText('Opcional')} />
      </label>
      <p className="form-hint">
        {uiText(
          'Dividendos: cantidad \u00D7 importe unitario. Splits: cantidad = factor nuevo/anterior; precio y comisiones = 0. Los movimientos se ordenan por fecha y registro.',
        )}
      </p>
      <Button disabled={busy} type="submit">
        {uiText(busy ? 'Guardando...' : 'Registrar movimiento')}
      </Button>
    </form>
  );
}
