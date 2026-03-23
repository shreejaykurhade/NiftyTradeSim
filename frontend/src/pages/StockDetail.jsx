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
      </div>

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

