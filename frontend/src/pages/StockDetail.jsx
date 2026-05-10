import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../services/api';
import { getSocket, useMarketSocket, useOrderSocket } from '../hooks/useSocket';
import { useAuth } from '../contexts/AuthContext';
import Chart from '../components/Chart';
import MetricCard from '../components/MetricCard';
import { cleanSymbol, compactVolume, formatCurrency, formatNumber, formatPercent } from '../utils/format';

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

  const rangeOptions = useMemo(() => {
    if (timeframe === '1W') return ['6M', '1Y', '3Y', '5Y', 'ALL'];
    if (timeframe === '1M') return ['1Y', '3Y', '5Y', 'ALL'];
    return ['1M', '3M', '6M', '1Y', '3Y', '5Y', 'ALL'];
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
            <Chart data={candles} liveUpdate={current} timeframe={timeframe} range={range} height={500} symbol={cleanSymbol(stock.symbol)} />
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
          <AgentsPanel symbol={symbol} />
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
      <div className="grid gap-6 p-6 lg:grid-cols-[1fr_340px]">
        <div>
          <p className="label">AI research</p>
          <h3 className="mt-3 text-2xl font-semibold">Generate institutional-style market report</h3>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary">
            Builds a structured report from live quote context, domestic news, sector/peer context, global market perception, risks, catalysts, and a paper-trade action plan.
          </p>
          <button onClick={onFetch} disabled={loading} className="btn-secondary mt-5">
            {loading ? 'Generating research packet...' : 'Generate AI report'}
          </button>
        </div>
        <div className="rounded-md border border-border-color bg-bg-secondary p-4">
          <p className="text-sm font-semibold">Report includes</p>
          <div className="mt-3 grid gap-2 text-sm text-text-secondary">
            <span>Market snapshot and valuation context</span>
            <span>Domestic, sector, and global perception</span>
            <span>Catalysts, risks, and paper-trade plan</span>
            <span>Source quality and citations</span>
          </div>
        </div>
      </div>
    );
  }

  const scoreTone = Number(sentiment.score || 0) >= 60 ? 'text-accent-green' : Number(sentiment.score || 0) <= 40 ? 'text-accent-red' : 'text-accent-amber';
  const quote = sentiment.quote || {};

  return (
    <div className="grid gap-6 p-6 xl:grid-cols-[360px_1fr]">
      <div className="space-y-4">
        <div className="surface-flat p-5">
        <p className="label">Recommendation</p>
        <p className={`mt-3 text-3xl font-semibold ${scoreTone}`}>{sentiment.recommendation || 'Hold'}</p>
        <p className="mt-2 text-sm text-text-secondary">Confidence score: <span className="font-semibold text-text-primary">{sentiment.score || '--'}</span></p>
        <button onClick={onRefresh} disabled={loading} className="btn-ghost mt-5 w-full">{loading ? 'Refreshing...' : 'Refresh report'}</button>
        </div>

        <div className="surface-flat p-5">
          <p className="label">Score stack</p>
          <ScoreBar label="Buy" value={sentiment.buyScore} tone="bg-accent-green" />
          <ScoreBar label="Hold" value={sentiment.holdScore} tone="bg-accent-amber" />
          <ScoreBar label="Sell" value={sentiment.sellScore} tone="bg-accent-red" />
        </div>

        <div className="surface-flat p-5">
          <p className="label">Live context</p>
          <div className="mt-4 grid gap-3 text-sm">
            <InfoRow label="Price" value={quote.price ? formatCurrency(quote.price) : '--'} />
            <InfoRow label="Day range" value={quote.dayHigh && quote.dayLow ? `${formatCurrency(quote.dayLow)} - ${formatCurrency(quote.dayHigh)}` : '--'} />
            <InfoRow label="52W range" value={quote.fiftyTwoWeekLow && quote.fiftyTwoWeekHigh ? `${formatCurrency(quote.fiftyTwoWeekLow)} - ${formatCurrency(quote.fiftyTwoWeekHigh)}` : '--'} />
            <InfoRow label="Volume" value={quote.volume ? formatNumber(quote.volume) : '--'} />
            <InfoRow label="P/E" value={quote.trailingPE ? Number(quote.trailingPE).toFixed(2) : '--'} />
          </div>
        </div>
      </div>

      <div className="space-y-5">
        <div>
          <p className="label">Executive summary</p>
          <p className="mt-3 text-sm leading-7 text-text-secondary">{sentiment.summary || 'No summary available.'}</p>
        </div>

        {sentiment.sections && (
          <div className="grid gap-4 lg:grid-cols-2">
            <ReportSection title="Market snapshot" items={sentiment.sections.marketSnapshot} />
            <ReportSection title="Perception" items={sentiment.sections.perception} />
            <ReportSection title="Catalysts" items={sentiment.sections.catalysts} />
            <ReportSection title="Risks" items={sentiment.sections.risks} />
            <ReportSection title="Paper-trade plan" items={sentiment.sections.actionPlan} wide />
          </div>
        )}

        {sentiment.explanation && (
          <details className="surface-flat p-4">
            <summary className="cursor-pointer text-sm font-semibold">Analyst narrative</summary>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-text-secondary">{sentiment.explanation}</p>
          </details>
        )}

        {sentiment.dataQuality && (
          <div className="surface-flat p-4">
            <p className="label">Data quality</p>
            <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <InfoRow label="Quote" value={sentiment.dataQuality.quote || '--'} />
              <InfoRow label="Domestic" value={sentiment.dataQuality.domesticSources ?? 0} />
              <InfoRow label="Sector" value={sentiment.dataQuality.sectorSources ?? 0} />
              <InfoRow label="Synthesis" value={sentiment.dataQuality.aiSynthesis || '--'} />
            </div>
          </div>
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

function ScoreBar({ label, value, tone }) {
  const numeric = Math.max(0, Math.min(100, Number(value || 0)));
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold text-text-secondary">{label}</span>
        <span className="font-bold tabular-nums">{numeric}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-bg-primary">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${numeric}%` }} />
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border-color/60 pb-2 last:border-b-0 last:pb-0">
      <span className="text-text-muted">{label}</span>
      <span className="text-right font-semibold text-text-primary">{value}</span>
    </div>
  );
}

function ReportSection({ title, items = [], wide = false }) {
  const normalizedItems = Array.isArray(items) ? items : [items].filter(Boolean);
  if (!normalizedItems.length) return null;

  return (
    <div className={`surface-flat p-4 ${wide ? 'lg:col-span-2' : ''}`}>
      <p className="label">{title}</p>
      <div className="mt-3 space-y-2">
        {normalizedItems.map((item, index) => (
          <p key={`${title}-${index}`} className="text-sm leading-6 text-text-secondary">{item}</p>
        ))}
      </div>
    </div>
  );
}

function AgentsPanel({ symbol }) {
  return (
    <div className="p-8 text-center">
      <h3 className="text-lg font-semibold">Agent trading has a dedicated workspace</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-text-secondary">
        Run the Monte Carlo agent network, inspect the 10D technical and perception state, review scenarios, then return here to place the paper order.
      </p>
      <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
        <Link to="/agent-trading" className="btn-primary">Open Agent Trading</Link>
        <Link to={`/agent-trading?symbol=${encodeURIComponent(symbol)}`} className="btn-ghost">Use this symbol</Link>
      </div>
    </div>
  );
}
