import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import { useMarketSocket, getSocket } from '../hooks/useSocket';
import { useAuth } from '../contexts/AuthContext';
import Chart from '../components/Chart';

export default function StockDetail() {
  const { symbol } = useParams();
  const { refreshUser } = useAuth();
  const [stock, setStock] = useState(null);
  const [candles, setCandles] = useState([]);
  const [livePrice, setLivePrice] = useState(null);
  const [timeframe, setTimeframe] = useState('1D');
  const [range, setRange] = useState('1Y');
  const [quantity, setQuantity] = useState(1);
  const [orderStatus, setOrderStatus] = useState({ type: '', message: '' });
  const [sentiment, setSentiment] = useState(null);
  const [loadingSentiment, setLoadingSentiment] = useState(false);
  const [sentimentError, setSentimentError] = useState(null);

  const fetchSentiment = async () => {
    setLoadingSentiment(true);
    setSentimentError(null);
    try {
      const { data } = await api.get(`/sentiment/${symbol}`);
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
          api.get(`/candles/${symbol}?timeframe=${timeframe}&limit=3000`)
        ]);
        setStock(stockRes.data);
        setCandles(candleRes.data.data);
        setLivePrice(stockRes.data);
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
    }
  });

  const handleTrade = async (type) => {
    setOrderStatus({ type: 'loading', message: `Processing ${type} order...` });
    try {
      const endpoint = type === 'BUY' ? '/orders/buy' : '/orders/sell';
      const { data } = await api.post(endpoint, {
        stockSymbol: symbol,
        quantity: parseInt(quantity)
      });
      setOrderStatus({ type: 'success', message: data.message });
      refreshUser(); // Update balance
    } catch (err) {
      setOrderStatus({ type: 'error', message: err.response?.data?.error || 'Order failed' });
    }
  };

  if (!stock) return <div className="p-8 text-center text-text-secondary">Loading stock data...</div>;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 py-6 font-sans">
      {/* Main Column */}
      <div className="xl:col-span-2 space-y-4">
        <div className="card glass flex justify-between items-center p-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-accent-green">{stock.symbol.split('.')[0]}</h1>
            <span className="text-text-secondary text-sm">{stock.name}</span>
          </div>
          
          <div className="flex gap-2 bg-bg-primary/50 p-1 rounded-lg border border-border-color">
            <div className="flex gap-1 pr-2 border-r border-border-color">
              {['1M', '3M', '6M', '1Y', 'ALL'].map(r => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${
                    range === r ? 'bg-accent-green text-bg-primary' : 'text-text-secondary hover:text-text-primary'
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
                  className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${
                    timeframe === tf ? 'bg-indigo-500 text-white' : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="card glass p-2 h-[450px]">
          <Chart data={candles} liveUpdate={livePrice} timeframe={timeframe} range={range} />
        </div>

        {/* AI Sentiment Section (Now below the chart, taking full horizontal space in the main column) */}
        <div className="card glass space-y-4 border-t-4 border-indigo-500 shadow-xl overflow-hidden">
          <div className="flex justify-between items-center bg-indigo-500/5 -m-4 mb-4 p-4 border-b border-indigo-500/10">
            <h3 className="text-sm font-bold uppercase tracking-widest text-indigo-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
              AI Financial Insights & Deep Analysis
            </h3>
            <button 
              onClick={fetchSentiment}
              disabled={loadingSentiment}
              className={`text-[10px] px-4 py-1.5 rounded bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all font-black ${loadingSentiment ? 'animate-pulse cursor-not-allowed' : ''}`}
            >
              {loadingSentiment ? 'AGENTIC SEARCH IN PROGRESS...' : 'REFRESH AI INSIGHTS'}
            </button>
          </div>

          {sentimentError && (
            <div className="p-4 rounded bg-accent-red/10 text-accent-red text-xs text-center border border-accent-red/20 font-bold">
              ⚠️ {sentimentError}
            </div>
          )}

          {!sentiment && !loadingSentiment && !sentimentError && (
            <div className="text-center py-12 bg-bg-primary/30 rounded-xl border border-dashed border-border-color">
              <p className="text-sm text-text-secondary mb-4 max-w-md mx-auto">Get professional multi-agent sentiment analysis powered by Gemini 1.5 Flash and Tavily Deep Search.</p>
              <button 
                onClick={fetchSentiment} 
                className="px-8 py-3 rounded-full bg-indigo-500 text-white text-sm font-black hover:scale-105 active:scale-95 transition-all shadow-xl shadow-indigo-500/30 ring-4 ring-indigo-500/10"
              >
                GENERATE AI REPORT
              </button>
            </div>
          )}

          {sentiment && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="space-y-4">
                <div className="flex items-center gap-4 bg-bg-primary/50 p-4 rounded-xl border border-border-color shadow-inner">
                  <div className={`w-16 h-16 rounded-full border-4 flex items-center justify-center font-black text-2xl shadow-lg ${
                    (sentiment.score || 0) > 60 ? 'border-accent-green text-accent-green bg-accent-green/5 shadow-accent-green/10' : 
                    (sentiment.score || 0) < 40 ? 'border-accent-red text-accent-red bg-accent-red/5 shadow-accent-red/10' : 
                    'border-yellow-500 text-yellow-500 bg-yellow-500/5 shadow-yellow-500/10'
                  }`}>
                    {sentiment.score || '-'}
                  </div>
                  <div>
                    <h4 className="text-lg font-black uppercase text-text-primary tracking-tight">{sentiment.recommendation || 'No Recommendation'}</h4>
                    <p className="text-xs text-text-secondary font-mono tracking-tighter opacity-70 uppercase">AI CONFIDENCE SCORE</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-black text-indigo-400 tracking-widest flex items-center gap-2">
                    EXECUTIVE SUMMARY
                  </p>
                  <div className="text-sm text-text-primary leading-relaxed bg-indigo-500/5 p-4 rounded-xl border border-indigo-500/10 shadow-sm font-medium">
                    "{sentiment.summary || "No summary available."}"
                    
                    {sentiment.explanation && (
                      <details className="mt-4 border-t border-indigo-500/10 pt-4">
                        <summary className="cursor-pointer text-xs text-indigo-400 hover:text-indigo-300 font-bold uppercase transition-colors flex justify-between items-center bg-indigo-500/5 p-2 rounded">
                          AI Reasoning Engine Output
                          <span className="text-[10px] opacity-70">Expand Full Report ↓</span>
                        </summary>
                        <div className="mt-4 text-sm text-text-primary whitespace-pre-wrap leading-relaxed font-sans border-l-2 border-indigo-500/30 pl-6 pb-4">
                          {sentiment.explanation}
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-bg-primary/20 rounded-xl border border-border-color space-y-4">
                  <p className="text-xs font-black text-text-secondary tracking-widest border-b border-border-color pb-2">VERIFIED SOURCES & CITATIONS</p>
                  <div className="space-y-2">
                    {sentiment.citations?.length > 0 ? (
                      sentiment.citations.map((c, i) => (
                        <a 
                          key={i} 
                          href={c.url} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="text-xs text-indigo-400 hover:text-white hover:bg-indigo-500/20 flex items-center gap-3 p-3 rounded-lg border border-transparent hover:border-indigo-500/30 transition-all group"
                        >
                          <span className="opacity-50 font-mono text-xs w-6 h-6 flex items-center justify-center bg-indigo-500/10 rounded group-hover:bg-indigo-500 group-hover:text-white">[{i+1}]</span> 
                          <span className="truncate flex-1">{c.title}</span>
                        </a>
                      ))
                    ) : (
                      <p className="text-xs text-text-secondary italic">No citations found in the search context.</p>
                    )}
                  </div>
                  <div className="pt-2 flex justify-between items-center border-t border-border-color">
                    <span className="text-[9px] text-text-secondary uppercase opacity-50 tracking-tighter">Analysis Timestamp: {new Date(sentiment.timestamp).toLocaleString()}</span>
                    <span className="text-[9px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded font-bold">GEMINI 1.5 FLASH</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sidebar Column */}
      <div className="space-y-6">
        <div className="card glass space-y-6 shadow-xl border-t-4 border-accent-green">
          <div className="flex justify-between items-end border-b border-border-color pb-4">
            <div>
              <p className="text-xs text-text-secondary uppercase tracking-wider">Live Price (NSE)</p>
              <h2 className="text-3xl font-bold font-mono">₹ {livePrice?.price?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h2>
            </div>
            <div className={`text-right ${livePrice?.changePct >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
              <p className="text-sm font-bold">{livePrice?.changePct >= 0 ? '+' : ''}{livePrice?.changePct}%</p>
              <p className="text-xs">{livePrice?.change?.toFixed(2)}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs text-text-secondary uppercase mb-2">Quantity</label>
              <input
                type="number"
                min="1"
                className="w-full text-xl p-3 font-bold bg-bg-primary border border-border-color rounded focus:border-accent-green outline-none"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>

            <div className="flex justify-between text-sm text-text-secondary">
              <span>Required Margin:</span>
              <span className="font-bold text-text-primary">
                ₹ {((livePrice?.price || 0) * (quantity || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => handleTrade('BUY')} className="py-4 rounded-lg bg-accent-green text-bg-primary font-bold hover:brightness-110 transition-all">BUY</button>
              <button onClick={() => handleTrade('SELL')} className="py-4 rounded-lg bg-accent-red text-white font-bold hover:brightness-110 transition-all">SELL</button>
            </div>

            {orderStatus.message && (
              <div className={`p-3 rounded text-xs text-center font-medium ${
                orderStatus.type === 'success' ? 'bg-accent-green/10 text-accent-green' : 
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
    </div>
  );
}
