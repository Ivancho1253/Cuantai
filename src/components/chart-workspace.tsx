'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CandlestickChart,
  SlidersHorizontal,
  Save,
  Maximize2,
  Plus,
  Trash2,
  Minus,
  X,
  LayoutGrid,
  Columns2,
  Square,
  FolderOpen,
} from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from './app-shell';
import { Button, Modal, AssetIcon, DataBadge, Skeleton, ErrorState, SectionTitle } from './ui';
import { FinancialChart, type Drawing } from './financial-chart';
import {
  defaultIndicators,
  type IndicatorConfig,
  type IndicatorKind,
} from '@/lib/finance/indicators';
import { instruments } from '@/lib/market/catalog';
import { timeframes, type MarketSnapshot, type Timeframe } from '@/lib/market/types';
import { api, number, dateLabel, cn } from '@/lib/utils';
type Config = {
  instrumentIds: string[];
  timeframe: Timeframe;
  chartType: 'candles' | 'line' | 'area' | 'bars';
  logarithmic: boolean;
  indicators: IndicatorConfig[];
  drawings: Drawing[];
};
type Workspace = { id: string; name: string; config: Config };
export function ChartWorkspace({
  initialId = 'BINANCE:BTCUSDT:USDT',
  embedded = false,
}: {
  initialId?: string;
  embedded?: boolean;
}) {
  const { demo, user } = useApp();
  const qc = useQueryClient();
  const [ids, setIds] = useState([initialId]);
  const [timeframe, setTimeframe] = useState<Timeframe>('1D');
  const [chartType, setChartType] = useState<Config['chartType']>('candles');
  const [indicators, setIndicators] = useState<IndicatorConfig[]>(defaultIndicators);
  const [logarithmic, setLogarithmic] = useState(false);
  const [indicatorModal, setIndicatorModal] = useState(false);
  const [saveModal, setSaveModal] = useState(false);
  const [name, setName] = useState('Mi workspace');
  const [workspaceId, setWorkspaceId] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [drawMode, setDrawMode] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  const workspaces = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => api<Workspace[]>('workspaces'),
    enabled: Boolean(user) && !demo,
  });
  const effectiveIndicators = useMemo(
    () => indicators.filter((i) => !(i.kind === 'VWAP' && ['1D', '1W', '1M'].includes(timeframe))),
    [indicators, timeframe],
  );
  function load(id: string) {
    const w = workspaces.data?.find((w) => w.id === id);
    if (!w) return;
    setWorkspaceId(w.id);
    setName(w.name);
    setIds(w.config.instrumentIds);
    setTimeframe(w.config.timeframe);
    setChartType(w.config.chartType);
    setLogarithmic(w.config.logarithmic);
    setIndicators(w.config.indicators);
    setDrawings(w.config.drawings);
    toast.success('Workspace recuperado');
  }
  async function save() {
    if (!user || demo) {
      toast.info('Creá una cuenta para guardar tus gráficos.');
      return;
    }
    setSaving(true);
    try {
      const w = await api<Workspace>('workspaces', {
        method: 'POST',
        body: JSON.stringify({
          id: workspaceId,
          name,
          config: { instrumentIds: ids, timeframe, chartType, logarithmic, indicators, drawings },
        }),
      });
      setWorkspaceId(w.id);
      qc.invalidateQueries({ queryKey: ['workspaces'] });
      setSaveModal(false);
      toast.success('Workspace guardado en tu cuenta');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  function layout(n: number) {
    const choices = [initialId, 'NASDAQ:NVDA:USD', 'BINANCE:ETHUSDT:USDT', 'NYSE:JPM:USD'];
    setIds(Array.from({ length: n }, (_, i) => ids[i] ?? choices[i]));
  }
  return (
    <div className={cn('workspace-page', fullScreen && 'workspace-fullscreen')}>
      {!embedded && (
        <SectionTitle
          eyebrow="PROFESSIONAL CHARTING"
          title="Tu perspectiva. Tu terminal."
          description="Explorá el precio con todas las herramientas que necesitás."
          action={
            <Button variant="secondary" onClick={() => setSaveModal(true)}>
              <Save size={15} /> Guardar workspace
            </Button>
          }
        />
      )}
      <div className="terminal-toolbar">
        <div className="timeframe-group">
          {timeframes.map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={timeframe === tf ? 'active' : ''}
            >
              {tf}
            </button>
          ))}
        </div>
        <span className="toolbar-divider" />
        <select
          aria-label="Tipo de gráfico"
          value={chartType}
          onChange={(e) => setChartType(e.target.value as Config['chartType'])}
        >
          <option value="candles">Velas</option>
          <option value="line">Línea</option>
          <option value="area">Área</option>
          <option value="bars">Barras OHLC</option>
        </select>
        <button className="toolbar-button" onClick={() => setIndicatorModal(true)}>
          <SlidersHorizontal size={15} /> Indicadores{' '}
          <span>{indicators.filter((i) => i.visible).length}</span>
        </button>
        <button
          className={cn('toolbar-button', drawMode && 'active')}
          onClick={() => setDrawMode(!drawMode)}
          title="Activá y hacé clic en el gráfico para colocar un nivel"
        >
          <Minus size={16} /> Nivel
        </button>
        <button
          className={cn('toolbar-button', logarithmic && 'active')}
          onClick={() => setLogarithmic(!logarithmic)}
        >
          log
        </button>
        <div className="layout-buttons">
          {[
            [1, Square],
            [2, Columns2],
            [4, LayoutGrid],
          ].map(([n, Icon]) => {
            const I = Icon as typeof Square;
            return (
              <button
                key={String(n)}
                aria-label={`${n} gráficos`}
                onClick={() => layout(n as number)}
                className={ids.length === n ? 'active' : ''}
              >
                <I size={15} />
              </button>
            );
          })}
        </div>
        <button
          className="icon-button"
          onClick={() => setFullScreen(!fullScreen)}
          aria-label={fullScreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
        >
          {fullScreen ? <X size={17} /> : <Maximize2 size={17} />}
        </button>
      </div>
      <div className="workspace-meta">
        <span>
          <CandlestickChart size={14} /> {name}
        </span>
        <div>
          {workspaces.data?.length ? (
            <label className="workspace-picker">
              <FolderOpen size={13} />
              <select
                aria-label="Recuperar workspace"
                onChange={(e) => load(e.target.value)}
                value={workspaceId ?? ''}
              >
                <option value="">Abrir guardado...</option>
                {workspaces.data.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <span className="muted">
              {user ? 'Configuración personal' : 'Demo · guardado disponible con cuenta'}
            </span>
          )}
          <button className="text-link" onClick={() => setSaveModal(true)}>
            <Save size={13} /> Guardar
          </button>
        </div>
      </div>
      {drawMode && (
        <div className="info-strip">
          Hacé clic en el panel de precio para agregar una línea horizontal.
        </div>
      )}
      <div className={cn('chart-grid', ids.length > 1 && 'chart-grid-multiple')}>
        {ids.map((id, index) => (
          <ChartTile
            key={index}
            id={id}
            index={index}
            setId={(newId) => setIds(ids.map((old, n) => (n === index ? newId : old)))}
            timeframe={timeframe}
            chartType={chartType}
            logarithmic={logarithmic}
            indicators={effectiveIndicators}
            drawings={drawings.filter((d) => d.instrumentId === id)}
            height={ids.length === 1 ? 530 : 380}
            onPriceClick={
              drawMode
                ? (p) => {
                    setDrawings([
                      ...drawings,
                      {
                        id: crypto.randomUUID(),
                        instrumentId: id,
                        price: p,
                        label: `Nivel ${drawings.length + 1}`,
                        color: '#d9bd7a',
                      },
                    ]);
                    setDrawMode(false);
                  }
                : undefined
            }
          />
        ))}
      </div>
      {drawings.length > 0 && (
        <div className="drawing-list">
          {drawings.map((d) => (
            <span key={d.id}>
              {d.label} · {number(d.price)}
              <button
                aria-label={`Eliminar ${d.label}`}
                onClick={() => setDrawings(drawings.filter((x) => x.id !== d.id))}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="terminal-footnote">
        EMA inicializada con SMA · RSI y ATR con suavizado de Wilder · MACD 12/26/9 por defecto ·
        Los paneles son independientes entre gráficos.
      </div>
      <Modal
        open={indicatorModal}
        onOpenChange={setIndicatorModal}
        title="Indicadores técnicos"
        description="Combiná indicadores y ajustá sus parámetros. Sin límites por suscripción."
      >
        <div className="indicator-add">
          {(['EMA', 'SMA', 'RSI', 'MACD', 'BB', 'ATR', 'OBV', 'VWAP'] as IndicatorKind[]).map(
            (kind) => (
              <button
                key={kind}
                disabled={
                  indicators.length >= 50 ||
                  (kind === 'VWAP' && ['1D', '1W', '1M'].includes(timeframe))
                }
                onClick={() =>
                  setIndicators([
                    ...indicators,
                    {
                      id: crypto.randomUUID(),
                      kind,
                      period: kind === 'RSI' || kind === 'ATR' ? 14 : kind === 'MACD' ? 26 : 20,
                      color: '#b7db87',
                      visible: true,
                    },
                  ])
                }
              >
                <Plus size={12} />
                {kind}
              </button>
            ),
          )}
        </div>
        <div className="indicator-list">
          {indicators.map((i) => (
            <div className="indicator-row" key={i.id}>
              <input
                type="checkbox"
                checked={i.visible}
                aria-label={`Mostrar ${i.kind} ${i.period}`}
                onChange={(e) =>
                  setIndicators(
                    indicators.map((x) =>
                      x.id === i.id ? { ...x, visible: e.target.checked } : x,
                    ),
                  )
                }
              />
              <strong>{i.kind}</strong>
              <input
                type="number"
                min={i.kind === 'MACD' ? 13 : 1}
                max={2000}
                aria-label={`Período ${i.kind}`}
                value={i.period}
                onChange={(e) =>
                  setIndicators(
                    indicators.map((x) =>
                      x.id === i.id
                        ? {
                            ...x,
                            period: Math.min(
                              2000,
                              Math.max(i.kind === 'MACD' ? 13 : 1, Number(e.target.value)),
                            ),
                          }
                        : x,
                    ),
                  )
                }
              />
              <input
                type="color"
                aria-label={`Color ${i.kind}`}
                value={i.color}
                onChange={(e) =>
                  setIndicators(
                    indicators.map((x) => (x.id === i.id ? { ...x, color: e.target.value } : x)),
                  )
                }
              />
              <button
                className="icon-button"
                aria-label={`Eliminar ${i.kind} ${i.period}`}
                onClick={() => setIndicators(indicators.filter((x) => x.id !== i.id))}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
        <p className="form-hint">
          VWAP por sesión UTC, disponible en temporalidades intradiarias. MACD: período lento
          editable; rápido 12 y señal 9. Límite técnico: 50 indicadores por workspace para proteger
          el navegador.
        </p>
      </Modal>
      <Modal
        open={saveModal}
        onOpenChange={setSaveModal}
        title="Guardar tu perspectiva"
        description="Recuperá activos, indicadores, niveles y temporalidad desde tu cuenta."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          className="form-stack"
        >
          <label>
            Nombre del workspace
            <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
          </label>
          {!user || demo ? (
            <p className="info-strip">
              Necesitás iniciar sesión. <Link href="/register">Crear cuenta</Link>
            </p>
          ) : (
            <Button type="submit" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar workspace'} <Save size={15} />
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
  logarithmic,
  indicators,
  drawings,
  height,
  onPriceClick,
}: {
  id: string;
  index: number;
  setId: (id: string) => void;
  timeframe: Timeframe;
  chartType: Config['chartType'];
  logarithmic: boolean;
  indicators: IndicatorConfig[];
  drawings: Drawing[];
  height: number;
  onPriceClick?: (p: number) => void;
}) {
  const { demo } = useApp();
  const data = useQuery({
    queryKey: ['market', id, timeframe, demo],
    queryFn: () =>
      api<MarketSnapshot>(
        `market?id=${encodeURIComponent(id)}&timeframe=${timeframe}${demo ? '&demo=true' : ''}`,
      ),
  });
  const snapshot = data.data;
  return (
    <section className="panel chart-tile">
      <div className="chart-tile-header">
        <div className="asset-cell">
          {snapshot && <AssetIcon instrument={snapshot.instrument} small />}
          <select
            value={id}
            aria-label={`Activo del gráfico ${index + 1}`}
            onChange={(e) => setId(e.target.value)}
          >
            {!instruments.some((i) => i.id === id) && (
              <option value={id}>{snapshot?.instrument.name ?? id}</option>
            )}
            {instruments
              .filter((i) => i.type !== 'cash')
              .map((i) => (
                <option key={i.id} value={i.id}>
                  {i.symbol} · {i.exchange} · {i.currency}
                </option>
              ))}
          </select>
        </div>
        <strong className="numeric">{number(snapshot?.quote?.price)}</strong>
        <DataBadge status={snapshot?.quote?.status ?? 'unavailable'} />
      </div>
      <div className="indicator-legend">
        {indicators
          .filter((i) => i.visible)
          .map((i) => (
            <span key={i.id} style={{ color: i.color }}>
              <i style={{ background: i.color }} />
              {i.kind} {i.kind === 'MACD' ? `12/${i.period}/9` : i.period}
            </span>
          ))}
      </div>
      {data.isLoading ? (
        <Skeleton className="chart-skeleton" />
      ) : data.isError ? (
        <ErrorState message={data.error.message} retry={() => data.refetch()} />
      ) : snapshot?.candles.length ? (
        <FinancialChart
          candles={snapshot.candles}
          indicators={indicators}
          height={height}
          chartType={chartType}
          logarithmic={logarithmic}
          drawings={drawings}
          onPriceClick={onPriceClick}
        />
      ) : (
        <div className="chart-unavailable">{snapshot?.error ?? 'Histórico no disponible'}</div>
      )}
      <div className="chart-source">
        {snapshot?.provenance.source} · {dateLabel(snapshot?.provenance.asOf ?? '')} ·{' '}
        {snapshot?.instrument.currency}
      </div>
    </section>
  );
}
