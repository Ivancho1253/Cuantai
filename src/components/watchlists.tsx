'use client';
import { useText as useUiText } from './locale-provider';
import { useState } from 'react';
import Link from 'next/link';
import { assetHref } from '@/lib/market/asset-href';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Star, Trash2, ArrowUpRight } from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from './app-shell';
import { SectionTitle, Button, Modal, EmptyState, AssetIcon, ErrorState, DataBadge } from './ui';
import { api, number, dateLabel } from '@/lib/utils';
import { instruments } from '@/lib/market/catalog';
import type { Instrument, MarketSnapshot } from '@/lib/market/types';
export type Watchlist = {
  id: string;
  name: string;
  items: {
    id: string;
    instrument: Instrument;
  }[];
};
export function Watchlists() {
  const uiText = useUiText();
  const { user, demo } = useApp();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState('');
  const [instrumentId, setInstrumentId] = useState(instruments[0].id);
  const [busy, setBusy] = useState(false);
  const lists = useQuery({
    queryKey: ['watchlists'],
    queryFn: () => api<Watchlist[]>('watchlists'),
    enabled: Boolean(user) && !demo,
  });
  const current = lists.data?.find((l) => l.id === selected) ?? lists.data?.[0];
  async function create() {
    setBusy(true);
    try {
      const list = await api<Watchlist>('watchlists', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      setSelected(list.id);
      setName('');
      setCreateOpen(false);
      qc.invalidateQueries({ queryKey: ['watchlists'] });
      toast.success('Watchlist creada');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function edit(action: 'add' | 'remove' | 'delete', id?: string) {
    if (!current) return;
    setBusy(true);
    try {
      await api('watchlists', {
        method: 'PATCH',
        body: JSON.stringify({ id: current.id, action, instrumentId: id }),
      });
      qc.invalidateQueries({ queryKey: ['watchlists'] });
      setAddOpen(false);
      toast.success(action === 'add' ? 'Activo agregado' : 'Lista actualizada');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <SectionTitle
        eyebrow={uiText('PERSONAL WORKSPACE')}
        title={uiText('Segu\u00ED lo que te importa.')}
        description={uiText('Tus ideas, organizadas. Tus listas, sincronizadas con tu cuenta.')}
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus size={15} />
            {uiText(' Nueva watchlist')}
          </Button>
        }
      />
      {uiText(
        !user || demo ? (
          <EmptyState
            title={uiText('Tu radar empieza con una cuenta.')}
            action={
              <Link href="/register" className="button button-primary">
                {uiText('Crear mi espacio ')}
                <ArrowUpRight size={15} />
              </Link>
            }
          >
            {uiText(
              'Cre\u00E1 listas para tus inversiones de largo plazo, tecnolog\u00EDa, cripto o Argentina. Se guardan de forma privada.',
            )}
          </EmptyState>
        ) : lists.isError ? (
          <ErrorState message={lists.error.message} />
        ) : (
          <>
            <div className="watchlist-tabs">
              {uiText(
                lists.data?.map((list) => (
                  <button
                    key={list.id}
                    className={current?.id === list.id ? 'active' : ''}
                    onClick={() => setSelected(list.id)}
                  >
                    <Star size={14} />
                    {uiText(list.name)}
                    <span>{uiText(list.items.length)}</span>
                  </button>
                )),
              )}
            </div>
            {uiText(
              !current ? (
                <EmptyState
                  title={uiText('Las mejores ideas merecen seguimiento.')}
                  action={
                    <Button onClick={() => setCreateOpen(true)}>
                      <Plus size={15} />
                      {uiText(' Crear mi primera lista')}
                    </Button>
                  }
                >
                  {uiText(
                    'Agreg\u00E1 instrumentos de distintos mercados sin confundir sus especies o monedas.',
                  )}
                </EmptyState>
              ) : (
                <section className="panel">
                  <div className="panel-header">
                    <strong>{uiText(current.name)}</strong>
                    <div className="inline-actions">
                      <Button variant="secondary" onClick={() => setAddOpen(true)}>
                        <Plus size={14} />
                        {uiText(' Agregar activo')}
                      </Button>
                      <button
                        className="icon-button"
                        aria-label={uiText('Eliminar watchlist')}
                        onClick={() => edit('delete')}
                        disabled={busy}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  {uiText(
                    current.items.length ? (
                      <div>
                        {uiText(
                          current.items.map((item) => (
                            <WatchlistRow
                              key={item.id}
                              instrument={item.instrument}
                              onRemove={() => edit('remove', item.instrument.id)}
                            />
                          )),
                        )}
                      </div>
                    ) : (
                      <EmptyState
                        title={uiText('Un espacio para tu pr\u00F3xima idea.')}
                        action={
                          <Button variant="secondary" onClick={() => setAddOpen(true)}>
                            {uiText('Buscar un activo')}
                          </Button>
                        }
                      >
                        {uiText('Esta watchlist est\u00E1 lista para empezar.')}
                      </EmptyState>
                    ),
                  )}
                </section>
              ),
            )}
          </>
        ),
      )}
      <Modal
        open={createOpen}
        onOpenChange={setCreateOpen}
        title={uiText('Nueva watchlist')}
        description={uiText('Pon\u00E9 un nombre a tu pr\u00F3xima lista de seguimiento.')}
      >
        {uiText(
          !user || demo ? (
            <p>
              {uiText('Para guardar listas necesit\u00E1s')}
              {uiText(' ')}
              <Link className="text-link" href="/register">
                {uiText('crear una cuenta')}
              </Link>
              .
            </p>
          ) : (
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                create();
              }}
            >
              <label>
                {uiText('Nombre')}
                <input
                  aria-label={uiText('Nombre de watchlist')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={uiText('Por ejemplo, Long-term ideas')}
                  required
                  maxLength={60}
                />
              </label>
              <Button disabled={busy} type="submit">
                {uiText('Crear watchlist')}
              </Button>
            </form>
          ),
        )}
      </Modal>
      <Modal
        open={addOpen}
        onOpenChange={setAddOpen}
        title={uiText('Agregar un activo')}
        description={uiText('Seleccion\u00E1 el instrumento y su mercado exactos.')}
      >
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            edit('add', instrumentId);
          }}
        >
          <label>
            {uiText('Instrumento')}
            <select value={instrumentId} onChange={(e) => setInstrumentId(e.target.value)}>
              {uiText(
                instruments
                  .filter((i) => i.type !== 'cash')
                  .map((i) => (
                    <option key={i.id} value={i.id}>
                      {uiText(i.symbol)} · {uiText(i.exchange)} · {uiText(i.currency)} —{' '}
                      {uiText(i.name)}
                    </option>
                  )),
              )}
            </select>
          </label>
          <Button type="submit" disabled={busy}>
            {uiText('Agregar a la lista')}
          </Button>
        </form>
      </Modal>
    </>
  );
}
function WatchlistRow({ instrument, onRemove }: { instrument: Instrument; onRemove: () => void }) {
  const uiText = useUiText();
  const quote = useQuery({
    queryKey: ['market', instrument.id, '1D', false],
    queryFn: () => api<MarketSnapshot>(`market?id=${encodeURIComponent(instrument.id)}`),
  });
  const q = quote.data?.quote;
  return (
    <div className="watchlist-row">
      <Link className="asset-cell" href={assetHref(instrument)}>
        <AssetIcon instrument={instrument} />
        <div>
          <strong>{uiText(instrument.symbol)}</strong>
          <small>
            {uiText(instrument.name)} · {uiText(instrument.exchange)}
          </small>
        </div>
      </Link>
      <span className="numeric">
        {uiText(number(q?.price))} <small>{uiText(instrument.currency)}</small>
      </span>
      <span className={Number(q?.changePercent ?? 0) >= 0 ? 'positive' : 'negative'}>
        {uiText(number(q?.changePercent))}%
      </span>
      <div>
        <DataBadge status={q?.status ?? 'unavailable'} />
        <small>{uiText(dateLabel(q?.asOf ?? ''))}</small>
      </div>
      <button
        className="icon-button"
        aria-label={uiText('Eliminar {0} de watchlist', [instrument.symbol])}
        onClick={onRemove}
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}
export function WatchlistPicker({
  instrumentId,
  open,
  onOpenChange,
}: {
  instrumentId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const uiText = useUiText();
  const { user, demo } = useApp();
  const qc = useQueryClient();
  const lists = useQuery({
    queryKey: ['watchlists'],
    queryFn: () => api<Watchlist[]>('watchlists'),
    enabled: open && Boolean(user) && !demo,
  });
  const [busy, setBusy] = useState(false);
  async function add(id: string) {
    setBusy(true);
    try {
      await api('watchlists', {
        method: 'PATCH',
        body: JSON.stringify({ id, action: 'add', instrumentId }),
      });
      qc.invalidateQueries({ queryKey: ['watchlists'] });
      toast.success('Activo agregado a watchlist');
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={uiText('Guardar en watchlist')}
      description={uiText('Eleg\u00ED la lista donde quer\u00E9s seguir este activo.')}
    >
      {uiText(
        !user || demo ? (
          <Link className="button button-primary" href="/register">
            {uiText('Crear cuenta para guardar')}
          </Link>
        ) : lists.data?.length ? (
          <div className="form-stack">
            {uiText(
              lists.data.map((l) => (
                <Button key={l.id} variant="secondary" disabled={busy} onClick={() => add(l.id)}>
                  <Star size={15} />
                  {uiText(l.name)}
                </Button>
              )),
            )}
          </div>
        ) : (
          <div className="form-stack">
            <p>{uiText('Primero cre\u00E1 una lista en tu espacio.')}</p>
            <Link href="/watchlists" className="button button-primary">
              {uiText('Crear watchlist ')}
              <ArrowUpRight size={15} />
            </Link>
          </div>
        ),
      )}
    </Modal>
  );
}
