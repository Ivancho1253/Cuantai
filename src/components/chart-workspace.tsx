'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Columns2, FolderOpen, LayoutGrid, Save, Square } from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from './app-shell';
import { TradingViewChart } from './tradingview-chart';
import { AssetIcon, Button, Modal, SectionTitle } from './ui';
import { instruments } from '@/lib/market/catalog';
import {
  tradingViewSymbol,
  type TradingViewWorkspaceConfig,
  type TradingViewChartType,
} from '@/lib/market/tradingview';
import { timeframes, type Instrument, type Timeframe } from '@/lib/market/types';
import { api, cn } from '@/lib/utils';
type Workspace = {
  id: string;
  name: string;
  config:
    | TradingViewWorkspaceConfig
    | (Omit<TradingViewWorkspaceConfig, 'provider'> & { provider?: undefined });
};
export function ChartWorkspace({
  initialId = 'BINANCE:BTCUSDT:USDT',
  embedded = false,
}: {
  initialId?: string;
  embedded?: boolean;
}) {
  const { demo, user } = useApp();
  const qc = useQueryClient();
  const [ids, setIds] = useState([initialId]),
    [timeframe, setTimeframe] = useState<Timeframe>('1D'),
    [chartType, setChartType] = useState<TradingViewChartType>('candles');
  const [saveModal, setSaveModal] = useState(false),
    [name, setName] = useState('Mi workspace'),
    [workspaceId, setWorkspaceId] = useState<string>(),
    [saving, setSaving] = useState(false);
  const workspaces = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => api<Workspace[]>('workspaces'),
    enabled: Boolean(user) && !demo,
  });
  async function save() {
    if (!user || demo) {
      toast.info('Iniciá sesión para guardar la configuración de apertura.');
      return;
    }
    setSaving(true);
    try {
      const w = await api<Workspace>('workspaces', {
        method: 'POST',
        body: JSON.stringify({
          id: workspaceId,
          name,
          config: { provider: 'tradingview', instrumentIds: ids, timeframe, chartType },
        }),
      });
      setWorkspaceId(w.id);
      qc.invalidateQueries({ queryKey: ['workspaces'] });
      setSaveModal(false);
      toast.success('Workspace guardado en tu cuenta');
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  }
  function load(id: string) {
    const w = workspaces.data?.find((w) => w.id === id);
    if (!w) return;
    setWorkspaceId(w.id);
    setName(w.name);
    setIds(w.config.instrumentIds);
    setTimeframe(w.config.timeframe);
    setChartType(w.config.chartType);
    toast.success('Workspace recuperado');
    if (!w.config.provider)
      toast.info(
        'Se recuperaron activos, período y estilo. Los indicadores y dibujos del gráfico anterior no se trasladan a TradingView.',
      );
  }
  function layout(n: number) {
    const defaults = [initialId, 'NASDAQ:NVDA:USD', 'BINANCE:ETHUSDT:USDT', 'NYSE:JPM:USD'];
    setIds(Array.from({ length: n }, (_, index) => ids[index] ?? defaults[index]));
  }
  return (
    <div className="workspace-page tv-workspace">
      {!embedded && (
        <SectionTitle
          eyebrow="TRADINGVIEW CHARTS"
          title="El mercado, desde TradingView."
          description="Gráficos, cotizaciones e indicadores del widget oficial de TradingView."
          action={
            <Button variant="secondary" onClick={() => setSaveModal(true)}>
              <Save size={15} /> Guardar workspace
            </Button>
          }
        />
      )}
      <div className="terminal-toolbar">
        <label>
          Período al abrir
          <select
            aria-label="Temporalidad inicial"
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value as Timeframe)}
          >
            {timeframes.map((tf) => (
              <option key={tf}>{tf}</option>
            ))}
          </select>
        </label>
        <label>
          Estilo al abrir
          <select
            aria-label="Tipo de gráfico"
            value={chartType}
            onChange={(e) => setChartType(e.target.value as TradingViewChartType)}
          >
            <option value="candles">Velas</option>
            <option value="line">Línea</option>
            <option value="area">Área</option>
            <option value="bars">Barras OHLC</option>
          </select>
        </label>
        <div className="layout-buttons">
          {[
            [1, Square],
            [2, Columns2],
            [4, LayoutGrid],
          ].map(([count, Icon]) => {
            const I = Icon as typeof Square;
            return (
              <button
                key={String(count)}
                aria-label={`${count} gráficos`}
                aria-pressed={ids.length === count}
                className={ids.length === count ? 'active' : ''}
                onClick={() => layout(count as number)}
              >
                <I size={15} />
              </button>
            );
          })}
        </div>
      </div>
      <div className="workspace-meta">
        <span>{name}</span>
        <div>
          {Boolean(workspaces.data?.length) && (
            <label className="workspace-picker">
              <FolderOpen size={13} />
              <select
                aria-label="Recuperar workspace"
                value={workspaceId ?? ''}
                onChange={(e) => load(e.target.value)}
              >
                <option value="">Abrir guardado…</option>
                {workspaces.data!.map((w) => (
                  <option value={w.id} key={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button className="text-link" onClick={() => setSaveModal(true)}>
            <Save size={13} /> Guardar
          </button>
        </div>
      </div>
      <div className={cn('chart-grid', ids.length > 1 && 'chart-grid-multiple')}>
        {ids.map((id, index) => (
          <ChartTile
            key={index}
            id={id}
            index={index}
            setId={(newId) => setIds(ids.map((old, n) => (n === index ? newId : old)))}
            timeframe={timeframe}
            chartType={chartType}
            height={ids.length === 1 ? 650 : 480}
          />
        ))}
      </div>
      <p className="terminal-footnote">
        Los datos y las herramientas de cada gráfico provienen de TradingView, incluso en la demo.
        La disponibilidad y demora dependen de TradingView y del mercado. Los indicadores y dibujos
        se gestionan dentro del widget; Cuantai guarda solo la configuración de apertura.
      </p>
      <Modal
        open={saveModal}
        onOpenChange={setSaveModal}
        title="Guardar tu perspectiva"
        description="Guardá activos, distribución, período y estilo de apertura. Los cambios internos del widget no se guardan en Cuantai."
      >
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <label>
            Nombre del workspace
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
          </label>
          {!user || demo ? (
            <p className="info-strip">
              Necesitás iniciar sesión. <Link href="/register">Crear cuenta</Link>
            </p>
          ) : (
            <Button type="submit" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar workspace'}
            </Button>
          )}
        </form>
      </Modal>
    </div>
  );
}
function ChartTile({
  id,
  index,
  setId,
  timeframe,
  chartType,
  height,
}: {
  id: string;
  index: number;
  setId: (id: string) => void;
  timeframe: Timeframe;
  chartType: TradingViewChartType;
  height: number;
}) {
  const seed = instruments.find((i) => i.id === id);
  const metadata = useQuery({
    queryKey: ['instrument', id],
    queryFn: () => api<Instrument>(`instrument?id=${encodeURIComponent(id)}`),
    enabled: !seed,
  });
  const instrument = seed ?? metadata.data;
  return (
    <section className="panel chart-tile">
      <div className="chart-tile-header">
        <div className="asset-cell">
          {instrument && <AssetIcon instrument={instrument} small />}
          <select
            aria-label={`Activo del gráfico ${index + 1}`}
            value={id}
            onChange={(e) => setId(e.target.value)}
          >
            {!seed && <option value={id}>{instrument?.name ?? id}</option>}
            {instruments
              .filter((i) => i.type !== 'cash')
              .map((i) => (
                <option value={i.id} key={i.id}>
                  {i.symbol} · {i.exchange} · {i.currency}
                </option>
              ))}
          </select>
        </div>
        <span className="outlined-chip">Datos de TradingView</span>
      </div>
      {instrument ? (
        <TradingViewChart
          symbol={tradingViewSymbol(instrument)}
          timeframe={timeframe}
          chartType={chartType}
          height={height}
        />
      ) : (
        <div className="chart-unavailable">
          {metadata.isError ? 'No se pudo identificar el activo.' : 'Identificando activo…'}
        </div>
      )}
    </section>
  );
}
