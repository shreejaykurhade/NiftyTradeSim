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
  
  const [agentSimulation, setAgentSimulation] = useState(null);
  const [loadingSimulation, setLoadingSimulation] = useState(false);
  const [simulationError, setSimulationError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

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

  const fetchSimulation = async () => {
    setLoadingSimulation(true);
    setSimulationError(null);
    setAgentSimulation({ logs: [] }); // Reset state with empty logs for streaming
    
    try {
      const response = await fetch(`http://localhost:5000/api/agents/simulation/${symbol}`, {
        method: 'GET'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        // Parse SSE formatted chunks "data: {...}\n\n"
        let parts = buffer.split('\n\n');
        buffer = parts.pop(); // Keep the last incomplete chunk in the buffer
        
        for (const part of parts) {
          if (part.startsWith('data: ')) {
            const jsonStr = part.slice(6);
            try {
              const parsed = JSON.parse(jsonStr);
              
              if (parsed.type === 'log') {
                setAgentSimulation(prev => ({
                  ...prev,
                  logs: [...(prev?.logs || []), parsed.log]
                }));
              } else if (parsed.type === 'result') {
                setAgentSimulation(prev => ({
                  ...prev,
                  ...parsed.data,
                  logs: prev?.logs || [] // preserve accumulated logs
                }));
                setLoadingSimulation(false); // Done
              }
            } catch (e) {
              console.error("Error parsing SSE chunk:", e, jsonStr);
            }
          }
        }
      }
    } catch (err) {
      console.error('Simulation fetch failed', err);
      setSimulationError(err.message || 'Failed to run Agent Simulation');
      setLoadingSimulation(false);
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
    <div className="font-sans">
      <div className="flex gap-4 border-b border-border-color mb-6 mt-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-2 px-1 text-sm font-bold tracking-wider uppercase transition-all ${
            activeTab === 'overview' ? 'text-accent-green border-b-2 border-accent-green' : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Market Overview
        </button>
        <button
          onClick={() => setActiveTab('agents')}
          className={`pb-2 px-1 text-sm font-bold tracking-wider uppercase transition-all flex items-center gap-2 ${
            activeTab === 'agents' ? 'text-teal-400 border-b-2 border-teal-400' : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          RL Agent Predictions <span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-pulse"></span>
        </button>
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 pb-6">
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

          <div className="grid grid-cols-3 gap-2 py-2 border-b border-border-color/50">
            <div className="text-center">
              <p className="text-[8px] text-text-secondary uppercase mb-0.5">Open</p>
              <p className="text-[10px] font-bold text-text-primary">₹ {livePrice?.open?.toFixed(2)}</p>
            </div>
            <div className="text-center">
              <p className="text-[8px] text-text-secondary uppercase mb-0.5">High</p>
              <p className="text-[10px] font-bold text-accent-green">₹ {livePrice?.high?.toFixed(2)}</p>
            </div>
            <div className="text-center">
              <p className="text-[8px] text-text-secondary uppercase mb-0.5">Low</p>
              <p className="text-[10px] font-bold text-accent-red">₹ {livePrice?.low?.toFixed(2)}</p>
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
                {isLimitOrder && livePrice?.price && (
                  <div className="mt-1.5 flex justify-between text-[8px] font-black uppercase tracking-widest text-text-secondary/60">
                    <span>Min: ₹{(livePrice.price * 0.95).toFixed(2)}</span>
                    <span>Max: ₹{(livePrice.price * 1.05).toFixed(2)}</span>
                  </div>
                )}
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
      )}

      {activeTab === 'agents' && (
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 pb-6">
      {/* Quantitative Agent Simulation Section */}
      <div className="xl:col-span-3">
        <div className="card glass space-y-4 border-t-4 border-teal-500 shadow-xl overflow-hidden">
          <div className="flex justify-between items-center bg-teal-500/5 -m-4 mb-4 p-4 border-b border-teal-500/10">
            <h3 className="text-sm font-bold uppercase tracking-widest text-teal-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
              Algorithmic Consensus & Quantitative Agents
            </h3>
            <button
              onClick={fetchSimulation}
              disabled={loadingSimulation}
              className={`text-[10px] px-4 py-1.5 rounded bg-teal-500/20 text-teal-400 hover:bg-teal-500 hover:text-white transition-all font-black ${loadingSimulation ? 'animate-pulse cursor-not-allowed' : ''}`}
            >
              {loadingSimulation ? 'RUNNING 5D SIMULATION...' : 'RUN AGENT SIMULATION'}
            </button>
          </div>

          {simulationError && (
            <div className="p-6 rounded-2xl bg-bg-primary/50 border border-accent-red/20 text-center space-y-3">
              <p className="font-black text-white text-sm">Simulation Error</p>
              <p className="text-xs text-text-secondary">{simulationError}</p>
            </div>
          )}

          {!agentSimulation && !loadingSimulation && !simulationError && (
            <div className="text-center py-12 bg-bg-primary/30 rounded-xl border border-dashed border-border-color">
              <p className="text-sm text-text-secondary mb-4 max-w-md mx-auto">Run the multi-agent 5D state evaluation backed by Monte Carlo RL and FAISS Vector Search.</p>
              <button
                onClick={fetchSimulation}
                className="px-8 py-3 rounded-full bg-teal-500 text-white text-sm font-black hover:scale-105 active:scale-95 transition-all shadow-xl shadow-teal-500/30"
              >
                START AGENT NETWORK
              </button>
            </div>
          )}

          {agentSimulation && (
            <div className="space-y-6 p-2">
              {agentSimulation.action ? (
                <div className="flex items-center gap-6 bg-bg-primary/50 p-6 rounded-2xl border border-border-color animate-in fade-in zoom-in">
                  <div className={`w-24 h-24 rounded-full border-4 flex items-center justify-center font-black text-3xl shadow-lg ${
                    agentSimulation.action === 'Buy' ? 'border-accent-green text-accent-green' :
                    agentSimulation.action === 'Sell' ? 'border-accent-red text-accent-red' :
                    'border-yellow-500 text-yellow-500'
                  }`}>
                    {agentSimulation.consensus_score}%
                  </div>
                  <div>
                    <h4 className={`text-3xl font-black uppercase tracking-tight ${
                      agentSimulation.action === 'Buy' ? 'text-accent-green' :
                      agentSimulation.action === 'Sell' ? 'text-accent-red' : 'text-yellow-500'
                    }`}>
                      {agentSimulation.action}
                    </h4>
                    <p className="text-xs text-text-secondary font-mono tracking-tighter uppercase mt-1">
                      ALGORITHMIC CONSENSUS (MONTE CARLO RL)
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-4 bg-bg-primary/50 p-6 rounded-2xl border border-teal-500/30 animate-pulse">
                  <div className="w-12 h-12 rounded-full border-4 border-t-teal-500 border-r-teal-500 border-b-transparent border-l-transparent animate-spin"></div>
                  <div>
                    <h4 className="text-xl font-black uppercase tracking-tight text-teal-400">
                      Processing Live Pipeline...
                    </h4>
                    <p className="text-xs text-text-secondary font-mono tracking-tighter uppercase mt-1">
                      Extracting & Analyzing Market Data
                    </p>
                  </div>
                </div>
              )}

              <div className="bg-[#0D1117] p-6 rounded-xl border border-[#30363D] overflow-hidden">
                <div className="flex items-center gap-2 border-b border-[#30363D] pb-3 mb-4">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-accent-red"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <div className="w-3 h-3 rounded-full bg-accent-green"></div>
                  </div>
                  <span className="text-xs text-[#8B949E] font-mono tracking-widest ml-2">agent_network.log {loadingSimulation && <span className="animate-pulse">...</span>}</span>
                </div>
                
                <div className="space-y-3 font-mono text-xs overflow-y-auto max-h-[400px] scrollbar-thin scrollbar-thumb-[#30363D] flex flex-col-reverse">
                  <div className="flex flex-col gap-3">
                  {agentSimulation.logs?.map((log, idx) => (
                    <div key={idx} className="flex gap-3 animate-in slide-in-from-left-2 fade-in" style={{ animationFillMode: 'both' }}>
                      <span className="text-[#8B949E] w-32 shrink-0">[{log.agent}]</span>
                      <span className={`${
                        log.message.includes('Buy') || log.message.includes('positive') || log.message.includes('bullish') ? 'text-accent-green' :
                        log.message.includes('Sell') || log.message.includes('negative') || log.message.includes('bearish') || log.message.includes('Error') ? 'text-accent-red' :
                        log.message.includes('Vector weight') ? 'text-[#E5C07B]' : 'text-[#A9B2C3]'
                      }`}>
                        {log.message}
                      </span>
                    </div>
                  ))}
                  </div>
                </div>
              </div>

              {agentSimulation.scenarios && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                  {agentSimulation.scenarios.map((scen, idx) => (
                    <div key={idx} className="bg-bg-primary/50 p-4 rounded-xl border border-border-color hover:border-teal-500/30 transition-all shadow-inner">
                      <div className="flex justify-between items-start mb-2">
                        <h5 className="text-xs font-bold uppercase text-text-primary w-2/3">{scen.name}</h5>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded ${
                          scen.probability > 60 ? 'bg-accent-green/20 text-accent-green' :
                          scen.probability < 40 ? 'bg-accent-red/20 text-accent-red' : 'bg-yellow-500/20 text-yellow-500'
                        }`}>{scen.probability.toFixed(0)}% PROB</span>
                      </div>
                      <p className="text-[10px] text-text-secondary leading-relaxed">{scen.catalyst}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="bg-indigo-500/5 p-4 rounded-xl border border-indigo-500/20 text-xs text-text-secondary mt-4 flex gap-4 items-start">
                <span className="text-2xl">🧠</span>
                <div>
                  <h5 className="text-indigo-400 font-bold uppercase tracking-widest mb-1">Why Reinforcement Learning?</h5>
                  <p>Traditional algorithms use static rules (e.g., "Buy if RSI &lt; 30"). This system uses <strong>Monte Carlo RL with FAISS Vector Search</strong> to dynamically match the current 10D market state against decades of historical outcomes. The agent learns the <em>policy</em> of what actions yielded the highest rewards in mathematically identical scenarios, adapting to market regimes automatically.</p>
                </div>
              </div>

              {agentSimulation.reasoning && (
                <div className="bg-teal-500/5 p-6 rounded-xl border border-teal-500/20 text-sm leading-relaxed mt-4">
                  <h4 className="text-teal-400 font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Vector State Reasoning Analysis
                  </h4>
                  <p className="text-text-primary italic">{agentSimulation.reasoning}</p>
                  {agentSimulation.vector && (
                    <div className="mt-4 pt-4 border-t border-teal-500/10">
                      <p className="text-xs text-text-secondary uppercase tracking-widest mb-2">Raw 5D Vector Tensor</p>
                      <div className="flex gap-2 flex-wrap">
                        {agentSimulation.vector.map((val, idx) => (
                          <div key={idx} className="px-3 py-1 bg-bg-primary rounded font-mono text-xs border border-border-color shadow-inner">
                            {['Price', 'Volume', 'Volatility', 'Momentum', 'Macro'][idx]}: {val > 0 ? '+' : ''}{val.toFixed(2)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      </div>
      )}
    </div>
  );
}
