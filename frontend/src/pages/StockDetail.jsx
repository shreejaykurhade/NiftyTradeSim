import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../services/api';
import { getSocket, useMarketSocket, useOrderSocket } from '../hooks/useSocket';
import { useAuth } from '../contexts/AuthContext';
import Chart from '../components/Chart';
import MetricCard from '../components/MetricCard';
import { cleanSymbol, compactVolume, formatCurrency, formatPercent } from '../utils/format';

function calculateRSI(candles, period = 14) {
  if (!candles || candles.length < period + 1) return 50;

  let gains = 0;
  let losses = 0;
  for (let i = candles.length - period; i < candles.length; i += 1) {
    const change = candles[i].close - candles[i - 1].close;
    if (change >= 0) gains += change;
    else losses += Math.abs(change);
  }

  if (losses === 0) return 100;
  const rs = gains / period / (losses / period);
  return 100 - 100 / (1 + rs);
}

function calculateVolatility(candles, period = 20) {
  if (!candles || candles.length < period) return 0;
  const recent = candles.slice(-period).map((candle) => candle.close);
  const mean = recent.reduce((sum, price) => sum + price, 0) / recent.length;
  const variance = recent.reduce((sum, price) => sum + (price - mean) ** 2, 0) / recent.length;
  return (Math.sqrt(variance) / mean) * 100;
}

export default function StockDetail() {
  const { symbol } = useParams();
  const { user, refreshUser } = useAuth();
  const [stock, setStock] = useState(null);
  const [candles, setCandles] = useState([]);
  const [livePrice, setLivePrice] = useState(null);
  const [timeframe, setTimeframe] = useState('1D');
  const [range, setRange] = useState('1Y');
  const [quantity, setQuantity] = useState(1);
  const [isLimitOrder, setIsLimitOrder] = useState(false);
  const [limitPrice, setLimitPrice] = useState('');
  const [orderStatus, setOrderStatus] = useState(null);
  const [activePanel, setActivePanel] = useState('insights');
  const [sentiment, setSentiment] = useState(null);
  const [sentimentLoading, setSentimentLoading] = useState(false);
  const [sentimentError, setSentimentError] = useState('');
  const [simulation, setSimulation] = useState(null);
  const [simulationLoading, setSimulationLoading] = useState(false);
  const [simulationError, setSimulationError] = useState('');

  const rangeOptions = useMemo(() => {
    if (timeframe === '1W') return ['1M', '6M', '1Y', 'ALL'];
    if (timeframe === '1M') return ['6M', '1Y', 'ALL'];
    return ['1D', '5D', '1M', '6M', '1Y', 'ALL'];
  }, [timeframe]);

  useEffect(() => {
    if (!rangeOptions.includes(range)) setRange(rangeOptions[0]);
  }, [range, rangeOptions]);

  useEffect(() => {
    async function fetchData() {
      try {
        const [stockRes, candleRes] = await Promise.all([
          api.get(`/market/stocks/${symbol}`),
          api.get(`/candles/${symbol}?timeframe=${timeframe}&limit=15000`),
        ]);
        setStock(stockRes.data);
        setLivePrice(stockRes.data);
        setCandles(candleRes.data.data || []);
        setLimitPrice(stockRes.data?.price || '');
      } catch (err) {
        console.error('Error fetching stock details', err);
      }
    }

    fetchData();
    const socket = getSocket();
    socket.emit('subscribe', [symbol]);
    return () => socket.emit('unsubscribe', [symbol]);
  }, [symbol, timeframe]);

  useMarketSocket((updates) => {
    const update = updates.find((item) => item.symbol === symbol);
    if (update) {
      setLivePrice((current) => ({ ...current, ...update }));
      if (!isLimitOrder) setLimitPrice(update.price);
    }
  });

  useOrderSocket(user?.id, (order) => {
    if (order.symbol === symbol || order.stockSymbol === symbol) refreshUser();
  });

  const metrics = useMemo(() => {
    const latest = livePrice || stock || {};
    return {
      rsi: calculateRSI(candles).toFixed(1),
      volatility: `${calculateVolatility(candles).toFixed(2)}%`,
      notional: Number(quantity || 0) * Number(isLimitOrder ? limitPrice || 0 : latest.price || 0),
      trendUp: Number(latest.changePct || 0) >= 0,
    };
  }, [candles, isLimitOrder, limitPrice, livePrice, quantity, stock]);

  const fetchSentiment = async (refresh = false) => {
    setSentimentLoading(true);
    setSentimentError('');
    try {
      const { data } = await api.get(`/sentiment/${symbol}${refresh ? '?refresh=true' : ''}`, { timeout: 240000 });
      if (data.error) throw new Error(data.error);
      setSentiment(data);
    } catch (err) {
      setSentimentError(err.response?.data?.error || err.message || 'Failed to get AI insights');
    } finally {
      setSentimentLoading(false);
    }
  };

  const fetchSimulation = async () => {
    setSimulationLoading(true);
    setSimulationError('');
    setSimulation({ logs: [] });

    try {
      const response = await fetch(`http://localhost:5000/api/agents/simulation/${symbol}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop();

        parts.forEach((part) => {
          if (!part.startsWith('data: ')) return;
          const parsed = JSON.parse(part.slice(6));
          if (parsed.type === 'log') {
            setSimulation((prev) => ({ ...prev, logs: [...(prev?.logs || []), parsed.log] }));
          }
          if (parsed.type === 'result') {
            setSimulation((prev) => ({ ...prev, ...parsed.data, logs: prev?.logs || [] }));
          }
        });
      }
    } catch (err) {
      setSimulationError(err.message || 'Failed to run agent simulation');
    } finally {
      setSimulationLoading(false);
    }
  };

  const handleTrade = async (type) => {
    setOrderStatus({ type: 'loading', message: `Submitting ${type.toLowerCase()} order...` });
    try {
      const payload = { stockSymbol: symbol, quantity: parseInt(quantity, 10) };
      if (isLimitOrder) payload.limitPrice = parseFloat(limitPrice);
      const { data } = await api.post(type === 'BUY' ? '/orders/buy' : '/orders/sell', payload);
      setOrderStatus({ type: 'success', message: data.message });
      refreshUser();
    } catch (err) {
      setOrderStatus({ type: 'error', message: err.response?.data?.error || 'Order failed' });
    }
  };

  if (!stock) {
    return <div className="py-24 text-center text-text-secondary">Loading stock workspace...</div>;
  }

  const current = livePrice || stock;

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link to="/" className="text-sm font-semibold text-text-secondary hover:text-accent-green">Back to market</Link>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{cleanSymbol(stock.symbol)}</h1>
            <span className="text-text-secondary">{stock.name}</span>
            <span className={`status-pill ${current.isMarketOpen ? 'bg-accent-green/10 text-accent-green' : 'bg-accent-red/10 text-accent-red'}`}>
              <span className={`h-2 w-2 rounded-full ${current.isMarketOpen ? 'bg-accent-green animate-pulse' : 'bg-accent-red'}`} />
              {current.isMarketOpen ? 'Live' : 'Closed'}
            </span>
          </div>
        </div>
        <div className="text-left lg:text-right">
          <p className={`text-4xl font-semibold tabular-nums ${metrics.trendUp ? 'text-accent-green' : 'text-accent-red'}`}>
            {formatCurrency(current.price)}
          </p>
          <p className={`mt-1 text-sm font-bold tabular-nums ${metrics.trendUp ? 'text-accent-green' : 'text-accent-red'}`}>
            {formatPercent(current.changePct)} {current.change ? `(${formatCurrency(current.change)})` : ''}
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Open" value={formatCurrency(current.open)} />
        <MetricCard label="High / Low" value={`${formatCurrency(current.high)} / ${formatCurrency(current.low)}`} />
        <MetricCard label="RSI 14" value={metrics.rsi} tone={Number(metrics.rsi) > 70 ? 'negative' : Number(metrics.rsi) < 30 ? 'positive' : 'amber'} />
        <MetricCard label="Volume" value={compactVolume(current.volume)} tone="blue" subvalue={`Volatility ${metrics.volatility}`} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <section className="surface overflow-hidden">
          <div className="flex flex-col gap-4 border-b border-border-color p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Price chart</h2>
              <p className="mt-1 text-sm text-text-secondary">Candlestick history with live tick updates.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {rangeOptions.map((item) => (
                <button key={item} onClick={() => setRange(item)} className={`rounded-md px-3 py-2 text-xs font-bold ${range === item ? 'bg-accent-green text-bg-primary' : 'bg-bg-secondary text-text-secondary hover:text-text-primary'}`}>
                  {item}
                </button>
              ))}
              {['1D', '1W', '1M'].map((item) => (
                <button key={item} onClick={() => setTimeframe(item)} className={`rounded-md px-3 py-2 text-xs font-bold ${timeframe === item ? 'bg-accent-blue text-white' : 'bg-bg-secondary text-text-secondary hover:text-text-primary'}`}>
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div className="min-h-[500px] p-4">
            <Chart data={candles} liveUpdate={current} timeframe={timeframe} range={range} height={500} />
          </div>
        </section>

        <aside className="surface p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Order ticket</h2>
              <p className="mt-1 text-sm text-text-secondary">Simulated execution only.</p>
            </div>
            <span className="rounded-md bg-bg-secondary px-3 py-1 text-xs font-bold text-text-secondary">NSE</span>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-2 rounded-md bg-bg-primary p-1">
            <button onClick={() => setIsLimitOrder(false)} className={`rounded-md py-2 text-sm font-bold ${!isLimitOrder ? 'bg-accent-green text-bg-primary' : 'text-text-secondary'}`}>Market</button>
            <button onClick={() => setIsLimitOrder(true)} className={`rounded-md py-2 text-sm font-bold ${isLimitOrder ? 'bg-accent-green text-bg-primary' : 'text-text-secondary'}`}>Limit</button>
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-semibold text-text-secondary">Quantity</label>
              <input type="number" min="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-text-secondary">Limit price</label>
              <input type="number" disabled={!isLimitOrder} value={limitPrice} onChange={(event) => setLimitPrice(event.target.value)} />
            </div>

            <div className="rounded-md border border-border-color bg-bg-secondary p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">Estimated value</span>
                <span className="font-semibold tabular-nums">{formatCurrency(metrics.notional)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-text-secondary">Buying power</span>
                <span className="font-semibold tabular-nums text-accent-green">{formatCurrency(user?.balance)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => handleTrade('BUY')} className="btn-primary py-3">Buy</button>
              <button onClick={() => handleTrade('SELL')} className="btn-danger py-3">Sell</button>
            </div>

            {orderStatus?.message && (
              <div className={`rounded-md border p-3 text-sm ${orderStatus.type === 'success' ? 'border-accent-green/30 bg-accent-green/10 text-accent-green' : orderStatus.type === 'loading' ? 'border-accent-blue/30 bg-accent-blue/10 text-accent-blue' : 'border-accent-red/30 bg-accent-red/10 text-accent-red'}`}>
                {orderStatus.message}
              </div>
            )}
          </div>
        </aside>
      </div>

      <section className="surface overflow-hidden">
        <div className="flex gap-2 border-b border-border-color p-4">
          <button onClick={() => setActivePanel('insights')} className={`rounded-md px-4 py-2 text-sm font-bold ${activePanel === 'insights' ? 'bg-accent-violet text-white' : 'bg-bg-secondary text-text-secondary'}`}>AI insights</button>
          <button onClick={() => setActivePanel('agents')} className={`rounded-md px-4 py-2 text-sm font-bold ${activePanel === 'agents' ? 'bg-accent-blue text-white' : 'bg-bg-secondary text-text-secondary'}`}>Agent simulation</button>
        </div>

        {activePanel === 'insights' ? (
          <InsightsPanel sentiment={sentiment} loading={sentimentLoading} error={sentimentError} onFetch={() => fetchSentiment(false)} onRefresh={() => fetchSentiment(true)} />
        ) : (
          <AgentsPanel simulation={simulation} loading={simulationLoading} error={simulationError} onRun={fetchSimulation} />
        )}
      </section>
    </div>
  );
}

function InsightsPanel({ sentiment, loading, error, onFetch, onRefresh }) {
  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-md border border-accent-red/30 bg-accent-red/10 p-4 text-sm text-accent-red">{error}</div>
      </div>
    );
  }

  if (!sentiment) {
    return (
      <div className="p-8 text-center">
        <h3 className="text-lg font-semibold">Generate AI market research</h3>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-text-secondary">
          Pull a structured sentiment report with recommendation, confidence, reasoning, and citations.
        </p>
        <button onClick={onFetch} disabled={loading} className="btn-secondary mt-5">{loading ? 'Generating...' : 'Generate report'}</button>
      </div>
    );
  }

  const scoreTone = Number(sentiment.score || 0) >= 60 ? 'text-accent-green' : Number(sentiment.score || 0) <= 40 ? 'text-accent-red' : 'text-accent-amber';

  return (
    <div className="grid gap-6 p-6 lg:grid-cols-[340px_1fr]">
      <div className="surface-flat p-5">
        <p className="label">Recommendation</p>
        <p className={`mt-3 text-3xl font-semibold ${scoreTone}`}>{sentiment.recommendation || 'Hold'}</p>
        <p className="mt-2 text-sm text-text-secondary">Confidence score: <span className="font-semibold text-text-primary">{sentiment.score || '--'}</span></p>
        <button onClick={onRefresh} disabled={loading} className="btn-ghost mt-5 w-full">{loading ? 'Refreshing...' : 'Refresh report'}</button>
      </div>
      <div className="space-y-5">
        <div>
          <p className="label">Executive summary</p>
          <p className="mt-3 text-sm leading-7 text-text-secondary">{sentiment.summary || 'No summary available.'}</p>
        </div>
        {sentiment.explanation && (
          <details className="surface-flat p-4" open>
            <summary className="cursor-pointer text-sm font-semibold">Full reasoning</summary>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-text-secondary">{sentiment.explanation}</p>
          </details>
        )}
        {sentiment.citations?.length > 0 && (
          <div>
            <p className="label">Sources</p>
            <div className="mt-3 grid gap-2">
              {sentiment.citations.map((citation, index) => (
                <a key={`${citation.url}-${index}`} href={citation.url} target="_blank" rel="noreferrer" className="rounded-md border border-border-color bg-bg-secondary p-3 text-sm text-text-secondary hover:text-accent-green">
                  {citation.title || citation.url}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AgentsPanel({ simulation, loading, error, onRun }) {
  if (!simulation && !loading) {
    return (
      <div className="p-8 text-center">
        <h3 className="text-lg font-semibold">Run quantitative agent simulation</h3>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-text-secondary">
          Stream the multi-agent evaluation pipeline and compare its action with your own trading thesis.
        </p>
        <button onClick={onRun} className="btn-secondary mt-5">Run simulation</button>
        {error && <p className="mt-4 text-sm text-accent-red">{error}</p>}
      </div>
    );
  }

  return (
    <div className="grid gap-6 p-6 lg:grid-cols-[320px_1fr]">
      <div className="surface-flat p-5">
        <p className="label">Consensus</p>
        <p className={`mt-3 text-3xl font-semibold ${simulation?.action === 'Sell' ? 'text-accent-red' : simulation?.action === 'Buy' ? 'text-accent-green' : 'text-accent-amber'}`}>
          {simulation?.action || 'Running'}
        </p>
        <p className="mt-2 text-sm text-text-secondary">Score: <span className="font-semibold text-text-primary">{simulation?.consensus_score || '--'}%</span></p>
        <button onClick={onRun} disabled={loading} className="btn-ghost mt-5 w-full">{loading ? 'Running...' : 'Run again'}</button>
      </div>
      <div className="rounded-md border border-border-color bg-[#060910] p-4 font-mono text-xs">
        <div className="mb-4 flex items-center justify-between border-b border-border-color pb-3">
          <span className="text-text-secondary">agent_network.log</span>
          <span className={loading ? 'text-accent-green' : 'text-text-muted'}>{loading ? 'streaming' : 'complete'}</span>
        </div>
        <div className="max-h-[360px] space-y-3 overflow-y-auto">
          {simulation?.logs?.length ? (
            simulation.logs.map((log, index) => (
              <div key={index} className="grid gap-3 sm:grid-cols-[150px_1fr]">
                <span className="text-text-muted">[{log.agent}]</span>
                <span className="text-text-secondary">{log.message}</span>
              </div>
            ))
          ) : (
            <p className="text-text-secondary">Waiting for streamed logs...</p>
          )}
        </div>
        {simulation?.reasoning && <p className="mt-5 border-t border-border-color pt-4 leading-6 text-text-secondary">{simulation.reasoning}</p>}
      </div>
      {error && <p className="lg:col-span-2 text-sm text-accent-red">{error}</p>}
    </div>
  );
}
