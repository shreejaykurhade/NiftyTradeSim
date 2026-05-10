import { createChart, ColorType, CandlestickSeries, CrosshairMode, HistogramSeries } from 'lightweight-charts';
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildLiveCandle, getVisibleRange, normalizeCandles } from '../utils/chartData';

const INR_FORMATTER = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const NUMBER_FORMATTER = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 0,
});

function formatPrice(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '--';
  return INR_FORMATTER.format(Number(value));
}

function formatVolume(value) {
  if (!Number(value)) return '--';
  return NUMBER_FORMATTER.format(Number(value));
}

function formatDate(time) {
  if (!time) return '--';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(Number(time) * 1000));
}

function candleChange(candle) {
  if (!candle) return 0;
  return Number(candle.close) - Number(candle.open);
}

function makeLegend(candle) {
  if (!candle) return null;
  const change = candleChange(candle);
  const changePct = candle.open ? (change / Number(candle.open)) * 100 : 0;
  return {
    ...candle,
    date: formatDate(candle.time),
    change,
    changePct,
  };
}

export default function Chart({ data, liveUpdate, timeframe = '1D', range = '1Y', height = 420, symbol = 'NSE' }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const lastCandleRef = useRef(null);
  const priceLineRef = useRef(null);
  const [legend, setLegend] = useState(null);

  const candles = useMemo(() => normalizeCandles(data), [data]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      autoSize: true,
      height,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#a7b0bf',
        fontFamily: 'Inter, system-ui, sans-serif',
      },
      localization: {
        priceFormatter: (price) => `₹${Number(price).toLocaleString('en-IN', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
        timeFormatter: (time) => formatDate(time),
      },
      grid: {
        vertLines: { color: 'rgba(34, 48, 68, 0.28)' },
        horzLines: { color: 'rgba(34, 48, 68, 0.36)' },
      },
      rightPriceScale: {
        visible: true,
        borderVisible: true,
        borderColor: 'rgba(34, 48, 68, 0.85)',
        entireTextOnly: true,
        scaleMargins: { top: 0.12, bottom: 0.25 },
      },
      timeScale: {
        visible: true,
        borderVisible: true,
        borderColor: 'rgba(34, 48, 68, 0.85)',
        timeVisible: false,
        secondsVisible: false,
        rightOffset: 8,
        barSpacing: 8,
        minBarSpacing: 3,
        fixLeftEdge: true,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: 'rgba(167, 176, 191, 0.45)',
          labelBackgroundColor: '#111824',
        },
        horzLine: {
          color: 'rgba(167, 176, 191, 0.45)',
          labelBackgroundColor: '#111824',
        },
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#16c784',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#16c784',
      wickDownColor: '#ef4444',
      priceFormat: {
        type: 'price',
        precision: 2,
        minMove: 0.01,
      },
      lastValueVisible: true,
      priceLineVisible: true,
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: '',
      color: 'rgba(59, 130, 246, 0.22)',
      lastValueVisible: false,
      priceLineVisible: false,
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    chart.subscribeCrosshairMove((param) => {
      if (!param?.time || !candleSeriesRef.current) {
        setLegend(makeLegend(lastCandleRef.current));
        return;
      }

      const hovered = param.seriesData.get(candleSeriesRef.current);
      setLegend(makeLegend(hovered || lastCandleRef.current));
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    return () => {
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      lastCandleRef.current = null;
      priceLineRef.current = null;
    };
  }, [height, timeframe]);

  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current || !volumeSeriesRef.current) return;

    if (!candles.length) {
      candleSeriesRef.current.setData([]);
      volumeSeriesRef.current.setData([]);
      lastCandleRef.current = null;
      setLegend(null);
      return;
    }

    candleSeriesRef.current.setData(candles);
    volumeSeriesRef.current.setData(
      candles.map((candle) => ({
        time: candle.time,
        value: candle.volume || 0,
        color: candle.close >= candle.open ? 'rgba(22, 199, 132, 0.24)' : 'rgba(239, 68, 68, 0.22)',
      }))
    );
    lastCandleRef.current = candles[candles.length - 1];
    setLegend(makeLegend(lastCandleRef.current));
    updateLastPriceLine(candleSeriesRef.current, priceLineRef, lastCandleRef.current);

    const visibleRange = getVisibleRange(candles, range);
    if (visibleRange) {
      chartRef.current.timeScale().setVisibleRange(visibleRange);
    } else {
      chartRef.current.timeScale().fitContent();
    }
  }, [candles, range]);

  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current || !liveUpdate?.price) return;

    const nextCandle = buildLiveCandle(lastCandleRef.current, liveUpdate, timeframe);
    if (!nextCandle) return;

    try {
      candleSeriesRef.current.update(nextCandle);
      volumeSeriesRef.current.update({
        time: nextCandle.time,
        value: nextCandle.volume || 0,
        color: nextCandle.close >= nextCandle.open ? 'rgba(22, 199, 132, 0.24)' : 'rgba(239, 68, 68, 0.22)',
      });
      lastCandleRef.current = nextCandle;
      setLegend(makeLegend(nextCandle));
      updateLastPriceLine(candleSeriesRef.current, priceLineRef, nextCandle);
    } catch {
      // Ignore out-of-order exchange ticks; the next clean snapshot will reset data.
    }
  }, [liveUpdate, timeframe]);

  const isPositive = Number(legend?.close || 0) >= Number(legend?.open || 0);

  return (
    <div className="relative h-full w-full" style={{ minHeight: height }}>
      <div className="absolute left-3 right-3 top-3 z-10 rounded-md border border-border-color bg-bg-primary/90 px-3 py-2 shadow-xl backdrop-blur">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span className="font-bold text-text-primary">{symbol}</span>
          <span className="text-text-muted">{legend?.date || 'Move cursor over chart'}</span>
          <LegendItem label="O" value={formatPrice(legend?.open)} />
          <LegendItem label="H" value={formatPrice(legend?.high)} tone="text-accent-green" />
          <LegendItem label="L" value={formatPrice(legend?.low)} tone="text-accent-red" />
          <LegendItem label="C" value={formatPrice(legend?.close)} tone={isPositive ? 'text-accent-green' : 'text-accent-red'} />
          <LegendItem label="Vol" value={formatVolume(legend?.volume)} />
          <span className={`font-semibold tabular-nums ${isPositive ? 'text-accent-green' : 'text-accent-red'}`}>
            {legend ? `${legend.change >= 0 ? '+' : ''}${legend.change.toFixed(2)} (${legend.changePct.toFixed(2)}%)` : '--'}
          </span>
        </div>
      </div>

      <div ref={chartContainerRef} className="h-full w-full pt-10" />
      {!candles.length && (
        <div className="absolute inset-0 grid place-items-center text-sm text-text-secondary">
          No chart data available for this instrument.
        </div>
      )}
    </div>
  );
}

function LegendItem({ label, value, tone = 'text-text-primary' }) {
  return (
    <span className="tabular-nums">
      <span className="text-text-muted">{label}</span>{' '}
      <span className={`font-semibold ${tone}`}>{value}</span>
    </span>
  );
}

function updateLastPriceLine(series, priceLineRef, candle) {
  if (!series || !candle?.close) return;
  if (priceLineRef.current) {
    series.removePriceLine(priceLineRef.current);
  }

  const isPositive = Number(candle.close) >= Number(candle.open);
  priceLineRef.current = series.createPriceLine({
    price: Number(candle.close),
    color: isPositive ? '#16c784' : '#ef4444',
    lineWidth: 1,
    lineStyle: 2,
    axisLabelVisible: true,
    title: 'Last',
  });
}
