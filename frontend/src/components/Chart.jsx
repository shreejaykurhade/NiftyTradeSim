import { createChart, ColorType, CandlestickSeries } from 'lightweight-charts';
import { useEffect, useRef } from 'react';

export default function Chart({ data, liveUpdate, timeframe, range }) {
  const chartContainerRef = useRef();
  const chartRef = useRef();
  const seriesRef = useRef();

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Initialize chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0b0e11' },
        textColor: '#848e9c',
      },
      grid: {
        vertLines: { color: '#2b3139' },
        horzLines: { color: '#2b3139' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
      timeScale: {
        borderColor: '#2b3139',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    // Use the explicit series type from the library
    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#0ecb81',
      downColor: '#f6465d',
      borderVisible: false,
      wickUpColor: '#0ecb81',
      wickDownColor: '#f6465d',
    });

    chartRef.current = chart;
    seriesRef.current = series;

    if (data && data.length > 0) {
      series.setData(data);
      
      // Handle range zooming
      if (range === 'ALL') {
        chart.timeScale().fitContent();
      } else {
        const lastTime = data[data.length - 1].time;
        let diff = 0;
        if (range === '1M') diff = 30 * 24 * 3600;
        else if (range === '3M') diff = 90 * 24 * 3600;
        else if (range === '6M') diff = 180 * 24 * 3600;
        else if (range === '1Y') diff = 365 * 24 * 3600;

        if (diff > 0) {
          chart.timeScale().setVisibleRange({
            from: lastTime - diff,
            to: lastTime,
          });
        }
      }
    }

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [data, range]); // Re-run when range changes


  // Handle live WebSocket updates
  useEffect(() => {
    if (seriesRef.current && liveUpdate && liveUpdate.price) {
      const timestamp = liveUpdate.time || Math.floor(Date.now() / 1000);
      
      try {
        seriesRef.current.update({
          time: timestamp,
          open: liveUpdate.open || liveUpdate.price,
          high: liveUpdate.high || liveUpdate.price,
          low: liveUpdate.low || liveUpdate.price,
          close: liveUpdate.price,
        });
      } catch (err) {
        console.warn('Chart update failed:', err);
      }
    }
  }, [liveUpdate]);

  return <div ref={chartContainerRef} className="w-full h-[400px]" />;
}

