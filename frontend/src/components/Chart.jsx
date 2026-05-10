import { createChart, ColorType, CandlestickSeries, HistogramSeries } from 'lightweight-charts';
import { useEffect, useMemo, useRef } from 'react';
import { buildLiveCandle, getVisibleRange, normalizeCandles } from '../utils/chartData';

export default function Chart({ data, liveUpdate, timeframe = '1D', range = '1Y', height = 420 }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const lastCandleRef = useRef(null);

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
      grid: {
        vertLines: { color: 'rgba(34, 48, 68, 0.28)' },
        horzLines: { color: 'rgba(34, 48, 68, 0.36)' },
      },
      rightPriceScale: {
        borderColor: 'rgba(34, 48, 68, 0.85)',
        scaleMargins: { top: 0.08, bottom: 0.24 },
      },
      timeScale: {
        borderColor: 'rgba(34, 48, 68, 0.85)',
        timeVisible: false,
        secondsVisible: false,
      },
      crosshair: {
        mode: 1,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#16c784',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#16c784',
      wickDownColor: '#ef4444',
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: '',
      color: 'rgba(59, 130, 246, 0.22)',
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.78, bottom: 0 },
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
    };
  }, [height]);

  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current || !volumeSeriesRef.current) return;

    if (!candles.length) {
      candleSeriesRef.current.setData([]);
      volumeSeriesRef.current.setData([]);
      lastCandleRef.current = null;
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
    } catch {
      // Ignore out-of-order exchange ticks; the next clean snapshot will reset data.
    }
  }, [liveUpdate, timeframe]);

  return (
    <div className="relative h-full w-full" style={{ minHeight: height }}>
      <div ref={chartContainerRef} className="h-full w-full" />
      {!candles.length && (
        <div className="absolute inset-0 grid place-items-center text-sm text-text-secondary">
          No chart data available for this instrument.
        </div>
      )}
    </div>
  );
}
