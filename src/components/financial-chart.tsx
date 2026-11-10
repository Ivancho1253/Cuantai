'use client';
import { useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  AreaSeries,
  BarSeries,
  HistogramSeries,
  ColorType,
  CrosshairMode,
  PriceScaleMode,
  type IChartApi,
  type ISeriesApi,
  type SeriesType,
  type Time,
  type IPriceLine,
} from 'lightweight-charts';
import type { Candle } from '@/lib/market/types';
import {
  ema,
  sma,
  rsi,
  macd,
  bollinger,
  atr,
  obv,
  vwap,
  closePoints,
  type IndicatorConfig,
  type Point,
} from '@/lib/finance/indicators';
export type Drawing = {
  id: string;
  instrumentId: string;
  price: number;
  label: string;
  color: string;
};
export function FinancialChart({
  candles,
  indicators = [],
  height = 360,
  chartType = 'candles',
  logarithmic = false,
  volume = true,
  drawings = [],
  onPriceClick,
}: {
  candles: Candle[];
  indicators?: IndicatorConfig[];
  height?: number;
  chartType?: 'candles' | 'line' | 'area' | 'bars';
  logarithmic?: boolean;
  volume?: boolean;
  drawings?: Drawing[];
  onPriceClick?: (price: number) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<Map<string, ISeriesApi<SeriesType>>>(new Map());
  const priceLines = useRef<IPriceLine[]>([]);
  const clickRef = useRef(onPriceClick);
  const fitKey = useRef('');
  const visibleCount = useRef(0);
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    clickRef.current = onPriceClick;
  }, [onPriceClick]);
  useEffect(() => {
    if (!container.current) return;
    const instance = createChart(container.current, {
      autoSize: true,
      height,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#7d8795',
        fontFamily: getComputedStyle(container.current).fontFamily,
        fontSize: 10,
        attributionLogo: true,
      },
      grid: {
        vertLines: { color: 'rgba(132,145,160,.055)' },
        horzLines: { color: 'rgba(132,145,160,.075)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#66736c', labelBackgroundColor: '#303d34' },
        horzLine: { color: '#66736c', labelBackgroundColor: '#303d34' },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.1, bottom: volume ? 0.24 : 0.08 },
      },
      timeScale: {
        borderColor: 'rgba(132,145,160,.1)',
        timeVisible: true,
        secondsVisible: false,
        barSpacing: 5,
        minBarSpacing: 2,
      },
      handleScroll: true,
      handleScale: true,
    });
    chart.current = instance;
    fitKey.current = '';
    const observer = new ResizeObserver(() => {
      if (visibleCount.current)
        instance.timeScale().setVisibleLogicalRange({
          from: Math.max(0, visibleCount.current - 120),
          to: visibleCount.current + 3,
        });
    });
    observer.observe(container.current);
    instance.subscribeClick((p) => {
      const main = series.current.get('price');
      if (p.point && main && clickRef.current) {
        const price = main.coordinateToPrice(p.point.y);
        if (price !== null) clickRef.current(price);
      }
    });
    const map = series.current;
    return () => {
      observer.disconnect();
      instance.remove();
      chart.current = null;
      map.clear();
    };
  }, [height, volume]);
  useEffect(() => {
    chart.current?.applyOptions({
      layout: { textColor: resolvedTheme === 'light' ? '#66717c' : '#7d8795' },
    });
  }, [resolvedTheme]);
  useEffect(() => {
    const c = chart.current;
    if (!c) return;
    const map = series.current;
    const active = new Set<string>();
    const ensure = (id: string, type: SeriesType, options: Record<string, unknown>, pane = 0) => {
      active.add(id);
      let s = map.get(id);
      if (s && s.seriesType() !== type) {
        c.removeSeries(s);
        map.delete(id);
        s = undefined;
      }
      if (!s) {
        const definition =
          type === 'Candlestick'
            ? CandlestickSeries
            : type === 'Bar'
              ? BarSeries
              : type === 'Area'
                ? AreaSeries
                : type === 'Histogram'
                  ? HistogramSeries
                  : LineSeries;
        s = c.addSeries(definition, options, pane);
        map.set(id, s);
      } else {
        s.applyOptions(options);
        if (s.getPane().paneIndex() !== pane) s.moveToPane(pane);
      }
      return s;
    };
    const mainType =
      chartType === 'candles'
        ? 'Candlestick'
        : chartType === 'bars'
          ? 'Bar'
          : chartType === 'area'
            ? 'Area'
            : 'Line';
    const main = ensure('price', mainType, {
      upColor: '#44c6a2',
      downColor: '#e07b86',
      borderVisible: false,
      wickUpColor: '#44c6a2',
      wickDownColor: '#e07b86',
      color: resolvedTheme === 'light' ? '#668f35' : '#b8e87e',
      lineColor: resolvedTheme === 'light' ? '#668f35' : '#b8e87e',
      topColor: resolvedTheme === 'light' ? 'rgba(102,143,53,.12)' : 'rgba(184,232,126,.18)',
      bottomColor: 'rgba(184,232,126,0)',
      lineWidth: 2,
      priceLineVisible: true,
      lastValueVisible: true,
    });
    main.setData(
      candles.map((b) =>
        chartType === 'line' || chartType === 'area'
          ? { time: b.time as Time, value: b.close }
          : { ...b, time: b.time as Time },
      ),
    );
    c.priceScale('right', 0).applyOptions({
      mode: logarithmic ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
    });
    if (volume) {
      const v = ensure('volume', 'Histogram', {
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
        priceLineVisible: false,
        lastValueVisible: false,
      });
      v.setData(
        candles.map((b) => ({
          time: b.time as Time,
          value: b.volume,
          color: b.close >= b.open ? '#3e9f8033' : '#bf6c7833',
        })),
      );
      v.priceScale().applyOptions({ scaleMargins: { top: 0.83, bottom: 0 } });
    }
    const points = closePoints(candles);
    let pane = 1;
    const line = (id: string, data: Point[], color: string, paneIndex = 0) => {
      const s = ensure(
        id,
        'Line',
        {
          color,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        },
        paneIndex,
      );
      s.setData(data.map((p) => ({ ...p, time: p.time as Time })));
    };
    for (const i of indicators.filter((i) => i.visible)) {
      if (i.kind === 'EMA' || i.kind === 'SMA')
        line(i.id, (i.kind === 'EMA' ? ema : sma)(points, i.period), i.color);
      if (i.kind === 'BB') {
        const bb = bollinger(points, i.period);
        line(i.id + '-up', bb.upper, i.color);
        line(i.id + '-mid', bb.middle, i.color);
        line(i.id + '-low', bb.lower, i.color);
      }
      if (i.kind === 'VWAP') line(i.id, vwap(candles), i.color);
      if (['RSI', 'ATR', 'OBV'].includes(i.kind)) {
        const data =
          i.kind === 'RSI'
            ? rsi(points, i.period)
            : i.kind === 'ATR'
              ? atr(candles, i.period)
              : obv(candles);
        line(i.id, data, i.color, pane);
        if (i.kind === 'RSI') {
          line(
            i.id + '-upper',
            data.map((p) => ({ time: p.time, value: 70 })),
            '#586052',
            pane,
          );
          line(
            i.id + '-lower',
            data.map((p) => ({ time: p.time, value: 30 })),
            '#586052',
            pane,
          );
        }
        pane++;
      }
      if (i.kind === 'MACD') {
        const m = macd(points, 12, Math.max(i.period, 13), 9);
        line(i.id + '-line', m.line, i.color, pane);
        line(i.id + '-signal', m.signal, '#d9b673', pane);
        const h = ensure(
          i.id + '-hist',
          'Histogram',
          { priceLineVisible: false, lastValueVisible: false },
          pane,
        );
        h.setData(
          m.histogram.map((p) => ({
            ...p,
            time: p.time as Time,
            color: p.value >= 0 ? '#42bc9677' : '#da738177',
          })),
        );
        pane++;
      }
    }
    for (const [id, s] of map)
      if (!active.has(id)) {
        c.removeSeries(s);
        map.delete(id);
      }
    c.panes().forEach((p, i) => p.setStretchFactor(i === 0 ? 4 : 1));
    const key = `${candles[0]?.time}:${candles.length}`;
    visibleCount.current = candles.length;
    if (fitKey.current !== key) {
      c.timeScale().setVisibleLogicalRange({
        from: Math.max(0, candles.length - 120),
        to: candles.length + 3,
      });
      fitKey.current = key;
    }
  }, [candles, indicators, chartType, logarithmic, volume, height, resolvedTheme]);
  useEffect(() => {
    const main = series.current.get('price');
    if (!main) return;
    for (const p of priceLines.current) {
      try {
        main.removePriceLine(p);
      } catch {
        /* Series type may have changed. */
      }
    }
    priceLines.current = drawings.map((d) =>
      main.createPriceLine({
        price: d.price,
        color: d.color,
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: d.label,
      }),
    );
  }, [drawings, chartType, candles]);
  return (
    <div
      ref={container}
      className="financial-chart"
      style={{ height }}
      aria-label="Gráfico financiero interactivo con zoom, velas e indicadores"
      role="img"
    />
  );
}
