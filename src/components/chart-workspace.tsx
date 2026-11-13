'use client';
import { useText as useUiText } from './locale-provider';
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
    | (Omit<TradingViewWorkspaceConfig, 'provider'> & {
        provider?: undefined;
      });
};
export function ChartWorkspace({
  initialId = 'BINANCE:BTCUSDT:USDT',
  embedded = false,
}: {
  initialId?: string;
  embedded?: boolean;
}) {
  const uiText = useUiText();
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
      {uiText(
        !embedded && (
          <SectionTitle
            eyebrow={uiText('TRADINGVIEW CHARTS')}
            title={uiText('El mercado, desde TradingView.')}
            description={uiText(
              'Gr\u00E1ficos, cotizaciones e indicadores del widget oficial de TradingView.',
            )}
            action={
              <Button variant="secondary" onClick={() => setSaveModal(true)}>
                <Save size={15} />
                {uiText(' Guardar workspace')}
              </Button>
            }
          />
        ),
      )}
      <div className="terminal-toolbar">
        <label>
          {uiText('Per\u00EDodo al abrir')}
          <select
            aria-label={uiText('Temporalidad inicial')}
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value as Timeframe)}
          >
            {uiText(timeframes.map((tf) => <option key={tf}>{uiText(tf)}</option>))}
          </select>
        </label>
        <label>
          {uiText('Estilo al abrir')}
          <select
            aria-label={uiText('Tipo de gr\u00E1fico')}
            value={chartType}
            onChange={(e) => setChartType(e.target.value as TradingViewChartType)}
          >
            <option value="candles">{uiText('Velas')}</option>
            <option value="line">{uiText('L\u00EDnea')}</option>
            <option value="area">{uiText('\u00C1rea')}</option>
            <option value="bars">{uiText('Barras OHLC')}</option>
          </select>
        </label>
        <div className="layout-buttons">
          {uiText(
            [
              [1, Square],
              [2, Columns2],
              [4, LayoutGrid],
            ].map(([count, Icon]) => {
              const I = Icon as typeof Square;
              return (
                <button
                  key={String(count)}
                  aria-label={uiText('{0} gr\u00E1ficos', [count])}
                  aria-pressed={ids.length === count}
                  className={ids.length === count ? 'active' : ''}
                  onClick={() => layout(count as number)}
                >
                  <I size={15} />
                </button>
              );
            }),
          )}
        </div>
      </div>
      <div className="workspace-meta">
        <span>{uiText(name)}</span>
        <div>
          {uiText(
            Boolean(workspaces.data?.length) && (
              <label className="workspace-picker">
                <FolderOpen size={13} />
                <select
                  aria-label={uiText('Recuperar workspace')}
                  value={workspaceId ?? ''}
                  onChange={(e) => load(e.target.value)}
                >
                  <option value="">{uiText('Abrir guardado\u2026')}</option>
                  {uiText(
                    workspaces.data!.map((w) => (
                      <option value={w.id} key={w.id}>
                        {uiText(w.name)}
                      </option>
                    )),
                  )}
                </select>
              </label>
            ),
          )}
          <button className="text-link" onClick={() => setSaveModal(true)}>
            <Save size={13} />
            {uiText(' Guardar')}
          </button>
        </div>
      </div>
      <div className={cn('chart-grid', ids.length > 1 && 'chart-grid-multiple')}>
        {uiText(
          ids.map((id, index) => (
            <ChartTile
              key={index}
              id={id}
              index={index}
              setId={(newId) => setIds(ids.map((old, n) => (n === index ? newId : old)))}
              timeframe={timeframe}
              chartType={chartType}
              height={ids.length === 1 ? 650 : 480}
            />
          )),
        )}
      </div>
      <p className="terminal-footnote">
        {uiText(
          'Los datos y las herramientas de cada gr\u00E1fico provienen de TradingView, incluso en la demo. La disponibilidad y demora dependen de TradingView y del mercado. Los indicadores y dibujos se gestionan dentro del widget; Cuantai guarda solo la configuraci\u00F3n de apertura.',
        )}
      </p>
      <Modal
        open={saveModal}
        onOpenChange={setSaveModal}
        title={uiText('Guardar tu perspectiva')}
        description={uiText(
          'Guard\u00E1 activos, distribuci\u00F3n, per\u00EDodo y estilo de apertura. Los cambios internos del widget no se guardan en Cuantai.',
        )}
      >
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <label>
            {uiText('Nombre del workspace')}
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
          </label>
          {uiText(
            !user || demo ? (
              <p className="info-strip">
                {uiText('Necesit\u00E1s iniciar sesi\u00F3n. ')}
                <Link href="/register">{uiText('Crear cuenta')}</Link>
              </p>
            ) : (
              <Button type="submit" disabled={saving}>
                {uiText(saving ? 'Guardando…' : 'Guardar workspace')}
              </Button>
            ),
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
  const uiText = useUiText();
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
          {uiText(instrument && <AssetIcon instrument={instrument} small />)}
          <select
            aria-label={uiText('Activo del gr\u00E1fico {0}', [index + 1])}
            value={id}
            onChange={(e) => setId(e.target.value)}
          >
            {uiText(!seed && <option value={id}>{uiText(instrument?.name ?? id)}</option>)}
            {uiText(
              instruments
                .filter((i) => i.type !== 'cash')
                .map((i) => (
                  <option value={i.id} key={i.id}>
                    {uiText(i.symbol)} · {uiText(i.exchange)} · {uiText(i.currency)}
                  </option>
                )),
            )}
          </select>
        </div>
        <span className="outlined-chip">{uiText('Datos de TradingView')}</span>
      </div>
      {uiText(
        instrument ? (
          <TradingViewChart
            symbol={tradingViewSymbol(instrument)}
            timeframe={timeframe}
            chartType={chartType}
            height={height}
          />
        ) : (
          <div className="chart-unavailable">
            {uiText(
              metadata.isError ? 'No se pudo identificar el activo.' : 'Identificando activo…',
            )}
          </div>
        ),
      )}
    </section>
  );
}
