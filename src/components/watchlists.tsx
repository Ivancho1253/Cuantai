'use client';
import { useState } from 'react';
import Link from 'next/link';
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
  items: { id: string; instrument: Instrument }[];
};
export function Watchlists() {
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
        eyebrow="PERSONAL WORKSPACE"
        title="Seguí lo que te importa."
        description="Tus ideas, organizadas. Tus listas, sincronizadas con tu cuenta."
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus size={15} /> Nueva watchlist
          </Button>
        }
      />
      {!user || demo ? (
        <EmptyState
          title="Tu radar empieza con una cuenta."
          action={
            <Link href="/register" className="button button-primary">
              Crear mi espacio <ArrowUpRight size={15} />
            </Link>
          }
        >
          Creá listas para tus inversiones de largo plazo, tecnología, cripto o Argentina. Se
          guardan de forma privada.
        </EmptyState>
      ) : lists.isError ? (
        <ErrorState message={lists.error.message} />
      ) : (
        <>
          <div className="watchlist-tabs">
            {lists.data?.map((list) => (
              <button
                key={list.id}
                className={current?.id === list.id ? 'active' : ''}
                onClick={() => setSelected(list.id)}
              >
                <Star size={14} />
                {list.name}
                <span>{list.items.length}</span>
              </button>
            ))}
          </div>
          {!current ? (
            <EmptyState
              title="Las mejores ideas merecen seguimiento."
              action={
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus size={15} /> Crear mi primera lista
                </Button>
              }
            >
              Agregá instrumentos de distintos mercados sin confundir sus especies o monedas.
            </EmptyState>
          ) : (
            <section className="panel">
              <div className="panel-header">
                <strong>{current.name}</strong>
                <div className="inline-actions">
                  <Button variant="secondary" onClick={() => setAddOpen(true)}>
                    <Plus size={14} /> Agregar activo
                  </Button>
                  <button
                    className="icon-button"
                    aria-label="Eliminar watchlist"
                    onClick={() => edit('delete')}
                    disabled={busy}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              {current.items.length ? (
                <div>
                  {current.items.map((item) => (
                    <WatchlistRow
                      key={item.id}
                      instrument={item.instrument}
                      onRemove={() => edit('remove', item.instrument.id)}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="Un espacio para tu próxima idea."
                  action={
                    <Button variant="secondary" onClick={() => setAddOpen(true)}>
                      Buscar un activo
                    </Button>
                  }
                >
                  Esta watchlist está lista para empezar.
                </EmptyState>
              )}
            </section>
          )}
        </>
      )}
      <Modal
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Nueva watchlist"
        description="Poné un nombre a tu próxima lista de seguimiento."
      >
        {!user || demo ? (
          <p>
            Para guardar listas necesitás{' '}
            <Link className="text-link" href="/register">
              crear una cuenta
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
              Nombre
              <input
                aria-label="Nombre de watchlist"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Por ejemplo, Long-term ideas"
                required
                maxLength={60}
              />
            </label>
            <Button disabled={busy} type="submit">
              Crear watchlist
            </Button>
          </form>
        )}
      </Modal>
      <Modal
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Agregar un activo"
        description="Seleccioná el instrumento y su mercado exactos."
      >
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            edit('add', instrumentId);
          }}
        >
          <label>
            Instrumento
            <select value={instrumentId} onChange={(e) => setInstrumentId(e.target.value)}>
              {instruments
                .filter((i) => i.type !== 'cash')
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.symbol} · {i.exchange} · {i.currency} — {i.name}
                  </option>
                ))}
            </select>
          </label>
          <Button type="submit" disabled={busy}>
            Agregar a la lista
          </Button>
        </form>
      </Modal>
    </>
  );
}
function WatchlistRow({ instrument, onRemove }: { instrument: Instrument; onRemove: () => void }) {
  const quote = useQuery({
    queryKey: ['market', instrument.id, '1D', false],
    queryFn: () => api<MarketSnapshot>(`market?id=${encodeURIComponent(instrument.id)}`),
  });
  const q = quote.data?.quote;
  return (
    <div className="watchlist-row">
      <Link className="asset-cell" href={`/asset/${instrument.exchange}/${instrument.symbol}`}>
        <AssetIcon instrument={instrument} />
        <div>
          <strong>{instrument.symbol}</strong>
          <small>
            {instrument.name} · {instrument.exchange}
          </small>
        </div>
      </Link>
      <span className="numeric">
        {number(q?.price)} <small>{instrument.currency}</small>
      </span>
      <span className={Number(q?.changePercent ?? 0) >= 0 ? 'positive' : 'negative'}>
        {number(q?.changePercent)}%
      </span>
      <div>
        <DataBadge status={q?.status ?? 'unavailable'} />
        <small>{dateLabel(q?.asOf ?? '')}</small>
      </div>
      <button
        className="icon-button"
        aria-label={`Eliminar ${instrument.symbol} de watchlist`}
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
      title="Guardar en watchlist"
      description="Elegí la lista donde querés seguir este activo."
    >
      {!user || demo ? (
        <Link className="button button-primary" href="/register">
          Crear cuenta para guardar
        </Link>
      ) : lists.data?.length ? (
        <div className="form-stack">
          {lists.data.map((l) => (
            <Button key={l.id} variant="secondary" disabled={busy} onClick={() => add(l.id)}>
              <Star size={15} />
              {l.name}
            </Button>
          ))}
        </div>
      ) : (
        <div className="form-stack">
          <p>Primero creá una lista en tu espacio.</p>
          <Link href="/watchlists" className="button button-primary">
            Crear watchlist <ArrowUpRight size={15} />
          </Link>
        </div>
      )}
    </Modal>
  );
}
