import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import { useMarketSocket, getSocket, useOrderSocket } from '../hooks/useSocket';
import { useAuth } from '../contexts/AuthContext';
import Chart from '../components/Chart';

// Helper functions for technical analysis
function calculateRSI(candles, period = 14) {
  if (!candles || candles.length < period + 1) return 50;

  const gains = [];
  const losses = [];

  for (let i = 1; i <= period; i++) {
    const change = candles[candles.length - i].close - candles[candles.length - i - 1].close;
    if (change > 0) {
      gains.push(change);
      losses.push(0);
    } else {
      gains.push(0);
      losses.push(Math.abs(change));
    }
  }

  const avgGain = gains.reduce((sum, gain) => sum + gain, 0) / period;
  const avgLoss = losses.reduce((sum, loss) => sum + loss, 0) / period;

  if (avgLoss === 0) return 100;

  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateVolatility(candles, period = 20) {
  if (!candles || candles.length < period) return 0;

  const recentPrices = candles.slice(-period).map(c => c.close);
  const mean = recentPrices.reduce((sum, price) => sum + price, 0) / period;
  const variance = recentPrices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / period;
  const stdDev = Math.sqrt(variance);

  return (stdDev / mean) * 100; // Coefficient of variation
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
  const [limitPrice, setLimitPrice] = useState(0);
  const [orderStatus, setOrderStatus] = useState({ type: '', message: '' });
  const [sentiment, setSentiment] = useState(null);
  const [loadingSentiment, setLoadingSentiment] = useState(false);
  const [sentimentError, setSentimentError] = useState(null);

  const fetchSentiment = async (isRefresh = false) => {
    setLoadingSentiment(true);
    setSentimentError(null);
    try {
      const { data } = await api.get(`/sentiment/${symbol}${isRefresh ? '?refresh=true' : ''}`, { timeout: 240000 });
      if (data.error) throw new Error(data.error);
      setSentiment(data);
    } catch (err) {
      console.error('Sentiment fetch failed', err);
      setSentimentError(err.response?.data?.error || err.message || 'Failed to get AI insights');
    } finally {
      setLoadingSentiment(false);
    }
  };

  useEffect(() => {
    async function fetchData() {
      try {
        const [stockRes, candleRes] = await Promise.all([
          api.get(`/market/stocks/${symbol}`),
          api.get(`/candles/${symbol}?timeframe=${timeframe}&limit=15000`)
        ]);
        setStock(stockRes.data);
        setCandles(candleRes.data.data);
        setLivePrice(stockRes.data);
        if (!isLimitOrder && stockRes.data?.price) {
          setLimitPrice(stockRes.data.price);
        }
      } catch (err) {
        console.error('Error fetching stock details', err);
      }
    }
    fetchData();

    // Subscribe to stock-specific room
    const socket = getSocket();
    socket.emit('subscribe', [symbol]);

    return () => {
      socket.emit('unsubscribe', [symbol]);
    };
  }, [symbol, timeframe]);

  useMarketSocket((updates) => {
    const myUpdate = updates.find(u => u.symbol === symbol);
    if (myUpdate) {
      setLivePrice(myUpdate);
      if (!isLimitOrder) setLimitPrice(myUpdate.price);
    }
  });

  useOrderSocket(user?.id, (order) => {
    if (order.symbol === symbol) {
      console.log('🎯 Relevant order executed!', order);
      refreshUser();
    }
  });

  const handleTrade = async (type) => {
    setOrderStatus({ type: 'loading', message: `Processing ${type} order...` });
    try {
      const endpoint = type === 'BUY' ? '/orders/buy' : '/orders/sell';
      const payload = {
        stockSymbol: symbol,
        quantity: parseInt(quantity)
      };
      if (isLimitOrder) payload.limitPrice = parseFloat(limitPrice);

      const { data } = await api.post(endpoint, payload);
      setOrderStatus({ type: 'success', message: data.message });
      refreshUser();
    } catch (err) {
      setOrderStatus({ type: 'error', message: err.response?.data?.error || 'Order failed' });
    }
  };

  const getPriceColor = () => {
    if (!livePrice || !livePrice.open) return 'text-text-primary';
    if (livePrice.price > livePrice.open) return 'text-accent-green';
    if (livePrice.price < livePrice.open) return 'text-accent-red';
    return 'text-text-primary';
  };

  const getBorderColor = () => {
    if (!livePrice || !livePrice.open) return 'border-border-color';
    if (livePrice.price > livePrice.open) return 'border-accent-green';
    if (livePrice.price < livePrice.open) return 'border-accent-red';
    return 'border-border-color';
  };

  if (!stock) return <div className="p-8 text-center text-text-secondary">Loading stock data...</div>;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 py-6 font-sans">
      {/* Chart Column (2 spans) */}
      <div className="xl:col-span-2 space-y-4">
        <div className="card glass flex justify-between items-center p-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-accent-green">{stock.symbol.split('.')[0]}</h1>
            <span className="text-text-secondary text-sm">{stock.name}</span>
            {stock.website && (
              <a
                href={stock.website}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 px-2 rounded-lg bg-bg-secondary border border-border-color text-text-secondary hover:text-accent-green hover:border-accent-green transition-all flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider group"
                title="Visit Website"
              >
                Website
                <svg className="w-2.5 h-2.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
              </a>
            )}
          </div>

          <div className="flex gap-2 bg-bg-primary/50 p-1 rounded-lg border border-border-color">
            <div className="flex gap-1 pr-2 border-r border-border-color">
              {['1D', '5D', '1M', '6M', '1Y', 'ALL'].map(r => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${range === r ? 'bg-accent-green text-bg-primary' : 'text-text-secondary hover:text-text-primary'
                    }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <div className="flex gap-1 pl-1">
              {['1D', '1W', '1M'].map(tf => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${timeframe === tf ? 'bg-indigo-500 text-white' : 'text-text-secondary hover:text-text-primary'
                    }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="card glass p-2 h-[550px]">
          <div className="px-4 py-2 border-b border-border-color flex justify-between items-center mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary">Fluctuation Trading Hub (1M Live)</span>
            <span className="text-[10px] text-accent-green font-bold uppercase tracking-tight flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse"></span>
              {timeframe} Resolution
            </span>
          </div>
          <Chart data={candles} liveUpdate={livePrice} timeframe={timeframe} range={range} />
        </div>
      </div>

      {/* Sidebar Column (1 span) */}
      <div className="space-y-6">
        <div className={`card glass space-y-6 shadow-xl border-t-4 ${getBorderColor()}`}>
          <div className="flex justify-between items-end border-b border-border-color pb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-text-secondary uppercase tracking-wider">Live Price (NSE)</span>
                {livePrice?.isMarketOpen ? (
                  <span className="flex items-center gap-1 text-[8px] font-black text-accent-green bg-accent-green/10 px-1.5 py-0.5 rounded-full border border-accent-green/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse"></span>
                    MARKET LIVE
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[8px] font-black text-accent-red bg-accent-red/10 px-1.5 py-0.5 rounded-full border border-accent-red/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-red"></span>
                    MARKET CLOSED
                  </span>
                )}
              </div>
              <h2 className={`text-3xl font-bold font-mono ${getPriceColor()}`}>₹ {livePrice?.price?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h2>
            </div>
            <div className={`text-right ${getPriceColor()}`}>
              <p className="text-sm font-bold">{livePrice?.changePct >= 0 ? '+' : ''}{livePrice?.changePct}%</p>
              <p className="text-xs">{livePrice?.change?.toFixed(2)}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex gap-2 p-1 bg-bg-primary rounded-lg border border-border-color mb-4">
              <button
                onClick={() => setIsLimitOrder(false)}
                className={`flex-1 py-1.5 text-[10px] font-bold rounded uppercase tracking-wider transition-all ${!isLimitOrder ? 'bg-accent-green text-bg-primary' : 'text-text-secondary hover:text-text-primary'}`}
              >
                Market
              </button>
              <button
                onClick={() => setIsLimitOrder(true)}
                className={`flex-1 py-1.5 text-[10px] font-bold rounded uppercase tracking-wider transition-all ${isLimitOrder ? 'bg-accent-green text-bg-primary' : 'text-text-secondary hover:text-text-primary'}`}
              >
                Limit
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-text-secondary uppercase mb-2">Quantity</label>
                <input
                  type="number"
                  min="1"
                  className="w-full text-lg p-3 font-bold bg-bg-primary border border-border-color rounded focus:border-accent-green outline-none"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-text-secondary uppercase mb-2">Price (INR)</label>
                <input
                  type="number"
                  disabled={!isLimitOrder}
                  className={`w-full text-lg p-3 font-bold bg-bg-primary border border-border-color rounded focus:border-accent-green outline-none ${!isLimitOrder ? 'opacity-50 cursor-not-allowed' : ''}`}
                  value={limitPrice}
                  onChange={(e) => setLimitPrice(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-between text-sm text-text-secondary">
              <span>Required Margin:</span>
              <span className="font-bold text-text-primary">
                ₹ {((isLimitOrder ? limitPrice : (livePrice?.price || 0)) * (quantity || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => handleTrade('BUY')} className="py-4 rounded-lg bg-accent-green text-bg-primary font-bold hover:brightness-110 transition-all">BUY</button>
              <button onClick={() => handleTrade('SELL')} className="py-4 rounded-lg bg-accent-red text-white font-bold hover:brightness-110 transition-all">SELL</button>
            </div>

            {orderStatus.message && (
              <div className={`p-3 rounded text-xs text-center font-medium ${orderStatus.type === 'success' ? 'bg-accent-green/10 text-accent-green' :
                'bg-accent-red/10 text-accent-red'
                }`}>
                {orderStatus.message}
              </div>
            )}
          </div>
        </div>

        <div className="card glass bg-bg-primary p-4 text-[10px] space-y-2 border-dashed border border-border-color text-text-secondary">
          <p className="text-accent-green font-bold text-xs">Paper Trading Notice</p>
          <p>Execution is simulated using live NIFTY 50 price feeds. No real money is involved.</p>
        </div>
      </div>

      {/* AI Sentiment Section (Now FULL WIDTH across Chart and Sidebar columns) */}
      <div className="xl:col-span-3 mt-4">
        <div className="card glass space-y-4 border-t-4 border-indigo-500 shadow-xl overflow-hidden">
          <div className="flex justify-between items-center bg-indigo-500/5 -m-4 mb-4 p-4 border-b border-indigo-500/10">
            <h3 className="text-sm font-bold uppercase tracking-widest text-indigo-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
              AI Financial Insights & Deep Analysis
            </h3>
            <button
              onClick={() => fetchSentiment(true)}
              disabled={loadingSentiment}
              className={`text-[10px] px-4 py-1.5 rounded bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all font-black ${loadingSentiment ? 'animate-pulse cursor-not-allowed' : ''}`}
            >
              {loadingSentiment ? 'AGENTIC SEARCH IN PROGRESS...' : 'REFRESH AI INSIGHTS'}
            </button>
          </div>

          {sentimentError && (
            <div className="p-6 rounded-2xl bg-bg-primary/50 border border-accent-red/20 text-center space-y-3">
              <div className="text-3xl">🔑</div>
              <p className="font-black text-white text-sm">Google API Key Required</p>
              <p className="text-xs text-text-secondary max-w-md mx-auto leading-relaxed">
                {sentimentError.includes('API key') || sentimentError.includes('Gemini')
                  ? 'Your GOOGLE_API_KEY in backend/.env is invalid or over quota. Get a fresh key at aistudio.google.com → restart backend.'
                  : sentimentError
                }
              </p>
              <button onClick={() => fetchSentiment(true)} className="text-[10px] px-4 py-1.5 rounded bg-accent-red/20 text-accent-red hover:bg-accent-red hover:text-white transition-all font-black">
                RETRY
              </button>
            </div>
          )}

          {!sentiment && !loadingSentiment && !sentimentError && (
            <div className="text-center py-12 bg-bg-primary/30 rounded-xl border border-dashed border-border-color">
              <p className="text-sm text-text-secondary mb-4 max-w-md mx-auto">Get professional multi-agent sentiment analysis powered by Gemini 1.5/2.0 and Tavily Deep Search.</p>
              <button
                onClick={fetchSentiment}
                className="px-8 py-3 rounded-full bg-indigo-500 text-white text-sm font-black hover:scale-105 active:scale-95 transition-all shadow-xl shadow-indigo-500/30 ring-4 ring-indigo-500/10"
              >
                GENERATE AI REPORT
              </button>
            </div>
          )}

          {sentiment && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-2 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="space-y-6">
                <div className="flex items-center gap-6 bg-bg-primary/50 p-6 rounded-2xl border border-border-color shadow-inner">
                  <div className={`w-20 h-20 rounded-full border-4 flex items-center justify-center font-black text-3xl shadow-lg ${(sentiment.score || 0) > 60 ? 'border-accent-green text-accent-green bg-accent-green/5 shadow-accent-green/10' :
                    (sentiment.score || 0) < 40 ? 'border-accent-red text-accent-red bg-accent-red/5 shadow-accent-red/10' :
                      'border-yellow-500 text-yellow-500 bg-yellow-500/5 shadow-yellow-500/10'
                    }`}>
                    {sentiment.score || '-'}
                  </div>
                  <div>
                    <h4 className="text-2xl font-black uppercase text-text-primary tracking-tight">{sentiment.recommendation || 'No Recommendation'}</h4>
                    <p className="text-xs text-text-secondary font-mono tracking-tighter opacity-70 uppercase">PROPRIETARY AI CONFIDENCE SCORE</p>
                  </div>
                </div>

                {/* Probability Breakdown */}
                <div className="bg-bg-primary/30 p-4 rounded-xl border border-border-color space-y-3 shadow-inner">
                  <div className="flex justify-between items-center text-[10px] font-black tracking-widest text-text-secondary uppercase">
                    <span>Sentiment Breakdown</span>
                    <span className="text-indigo-400">Total 100%</span>
                  </div>
                  <div className="space-y-4">
                    {[
                      { label: 'BUY', score: sentiment.buyScore, color: 'bg-accent-green' },
                      { label: 'HOLD', score: sentiment.holdScore, color: 'bg-yellow-500' },
                      { label: 'SELL', score: sentiment.sellScore, color: 'bg-accent-red' }
                    ].map(item => (
                      <div key={item.label} className="space-y-1">
                        <div className="flex justify-between text-[10px] font-bold">
                          <span>{item.label}</span>
                          <span>{item.score}%</span>
                        </div>
                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-border-color/30">
                          <div
                            className={`h-full ${item.color} shadow-[0_0_10px_rgba(0,0,0,0.5)] transition-all duration-1000 ease-out`}
                            style={{ width: `${item.score}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-xs font-black text-indigo-400 tracking-widest flex items-center gap-2 border-l-4 border-indigo-500 pl-3">
                    EXECUTIVE SUMMARY
                  </p>
                  <div className="text-base text-text-primary leading-relaxed bg-indigo-500/5 p-6 rounded-2xl border border-indigo-500/10 shadow-sm font-medium italic">
                    "{sentiment.summary || "No summary available."}"
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="p-6 bg-bg-primary/20 rounded-2xl border border-border-color space-y-6">
                  <p className="text-xs font-black text-text-secondary tracking-widest border-b border-border-color pb-3">VERIFIED SOURCES & CITATIONS</p>
                  <div className="grid grid-cols-1 gap-2">
                    {sentiment.citations?.length > 0 ? (
                      sentiment.citations.map((c, i) => (
                        <a
                          key={i}
                          href={c.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-indigo-400 hover:text-white hover:bg-indigo-500/20 flex items-center gap-4 p-4 rounded-xl border border-transparent hover:border-indigo-500/30 transition-all group"
                        >
                          <span className="opacity-50 font-mono text-sm w-10 h-10 flex items-center justify-center bg-indigo-500/10 rounded-lg group-hover:bg-indigo-500 group-hover:text-white transition-colors">[{i + 1}]</span>
                          <span className="truncate flex-1 font-bold">{c.title}</span>
                          <span className="text-[10px] bg-indigo-500/20 px-2 py-1 rounded-full opacity-0 group-hover:opacity-100 uppercase transition-opacity font-black">Source</span>
                        </a>
                      ))
                    ) : (
                      <p className="text-xs text-text-secondary italic">No citations found.</p>
                    )}
                  </div>
                  <div className="pt-4 flex justify-between items-center border-t border-border-color">
                    <span className="text-[10px] text-text-secondary uppercase opacity-60 font-medium font-mono">Report Generated: {new Date(sentiment.timestamp).toLocaleString()}</span>
                    <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-3 py-1 rounded-lg font-black tracking-widest">GEMINI AI AGENTIC</span>
                  </div>
                </div>
              </div>

              {/* Deep Analysis (Full Width below the 2-col summary) */}
              {sentiment.explanation && (
                <div className="md:col-span-2 mt-4">
                  <details className="border border-indigo-500/20 rounded-2xl overflow-hidden shadow-sm" open>
                    <summary className="cursor-pointer text-xs text-white bg-indigo-500/40 hover:bg-indigo-500/60 p-4 font-black uppercase transition-all flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="animate-pulse">⚡</span> AI Reasoning Engine Full Report
                      </div>
                      <span className="text-[10px] opacity-70 tracking-widest">SEQUENTIAL MULTI-AGENT ANALYSIS ↓</span>
                    </summary>
                    <div className="p-8 text-base text-text-primary whitespace-pre-wrap font-sans leading-relaxed bg-bg-primary shadow-inner">
                      {sentiment.explanation}
                    </div>
                  </details>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
