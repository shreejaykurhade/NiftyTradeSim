import { useState, useEffect } from 'react';
import api from '../services/api';
import { useMarketSocket } from '../hooks/useSocket';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function fetchStocks() {
      try {
        const { data } = await api.get('/market/stocks');
        setStocks(data);
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch stocks', err);
      }
    }
    fetchStocks();
  }, []);

  // Real-time updates via WebSocket
  useMarketSocket((updates) => {
    setStocks((prev) => {
      const newStocks = [...prev];
      updates.forEach((update) => {
        const idx = newStocks.findIndex((s) => s.symbol === update.symbol);
        if (idx !== -1) {
          // Keep a "lastClose" reference for animation flashing
          const prevPrice = newStocks[idx].price;
          newStocks[idx] = { 
            ...newStocks[idx], 
            ...update, 
            flash: update.price > prevPrice ? 'up' : update.price < prevPrice ? 'down' : null 
          };
        }
      });
      return newStocks;
    });
  });

  const filtered = stocks.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    s.symbol.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="py-4 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">NIFTY 50 Market</h1>
          <p className="text-text-secondary text-sm">Real-time prices from Indian indices</p>
        </div>
        
        <div className="w-full md:w-64">
          <input
            type="text"
            className="w-full"
            placeholder="Search stock..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="card glass p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-bg-primary text-text-secondary text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Symbol</th>
                <th className="px-6 py-4">Stock Name</th>
                <th className="px-6 py-4 text-right">Last Price (₹)</th>
                <th className="px-6 py-4 text-right">Change</th>
                <th className="px-6 py-4 text-right">Volume</th>
                <th className="px-6 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-color">
              {loading ? (
                <tr><td colSpan="6" className="text-center py-12">Loading market data...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan="6" className="text-center py-12 text-text-secondary">No stocks found</td></tr>
              ) : filtered.map((stock) => (
                <tr key={stock.symbol} className="hover:bg-bg-primary/50 transition-colors group">
                  <td className="px-6 py-4 font-bold text-accent-green">{stock.symbol.split('.')[0]}</td>
                  <td className="px-6 py-4 text-sm font-medium">{stock.name}</td>
                  <td className={`px-6 py-4 text-right font-bold transition-all duration-300 ${
                    stock.flash === 'up' ? 'text-accent-green bg-accent-green/10' : 
                    stock.flash === 'down' ? 'text-accent-red bg-accent-red/10' : ''
                  }`}>
                    {stock.price ? stock.price.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}
                  </td>
                  <td className={`px-6 py-4 text-right font-medium ${
                    stock.changePct >= 0 ? 'text-accent-green' : 'text-accent-red'
                  }`}>
                    {stock.changePct >= 0 ? '+' : ''}{stock.changePct}%
                  </td>
                  <td className="px-6 py-4 text-right text-xs text-text-secondary">
                    {stock.volume ? (stock.volume / 1000000).toFixed(2) + 'M' : '—'}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <Link 
                      to={`/stock/${stock.symbol}`}
                      className="inline-block px-4 py-1 rounded text-xs font-bold border border-accent-green text-accent-green hover:bg-accent-green hover:text-bg-primary transition-all"
                    >
                      TRADE
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
