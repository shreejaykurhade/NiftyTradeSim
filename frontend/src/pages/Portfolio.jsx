import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { useOrderSocket } from '../hooks/useSocket';

export default function Portfolio() {
  const { user, refreshUser } = useAuth();
  const [portfolio, setPortfolio] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchPortfolio = async () => {
    try {
      const { data } = await api.get('/portfolio');
      setPortfolio(data);
    } catch (err) {
      console.error('Portfolio fetch failed', err);
    }
  };

  const fetchOrders = async () => {
    try {
      const { data } = await api.get('/orders');
      setOrders(data);
    } catch (err) {
      console.error('Orders fetch failed', err);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchPortfolio(), fetchOrders()]);
      setLoading(false);
    };
    init();
  }, []);

  // Listen for real-time order updates from either this user or AI agents
  useOrderSocket(user?.id, (order) => {
    console.log('📦 Order executed!', order);
    fetchPortfolio();
    fetchOrders();
    refreshUser();
  });

  if (loading) return <div className="p-8 text-center text-text-secondary">Loading portfolio...</div>;

  return (
    <div className="py-8 space-y-8">
      {/* Portfolio Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card glass flex flex-col justify-between">
          <span className="text-xs text-text-secondary uppercase font-bold tracking-widest">Available Cash</span>
          <span className="text-2xl font-black mt-2">₹ {user.balance.toLocaleString('en-IN')}</span>
        </div>
        <div className="card glass flex flex-col justify-between">
          <span className="text-xs text-text-secondary uppercase font-bold tracking-widest">Total Invested</span>
          <span className="text-2xl font-black mt-2 text-text-primary tracking-tighter">
            ₹ {portfolio?.summary?.totalInvested.toLocaleString('en-IN')}
          </span>
        </div>
        <div className="card glass border-l-4 border-accent-green flex flex-col justify-between">
          <span className="text-xs text-text-secondary uppercase font-bold tracking-widest">Current Value</span>
          <span className="text-2xl font-black mt-2 text-accent-green">
            ₹ {portfolio?.summary?.totalCurrent.toLocaleString('en-IN')}
          </span>
        </div>
        <div className={`card glass border-l-4 flex flex-col justify-between ${portfolio?.summary?.totalPnl >= 0 ? 'border-accent-green' : 'border-accent-red'}`}>
          <span className="text-xs text-text-secondary uppercase font-bold tracking-widest">Total P&L</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl font-black ${portfolio?.summary?.totalPnl >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
              ₹ {portfolio?.summary?.totalPnl.toLocaleString('en-IN')}
            </span>
            <span className={`text-sm font-bold ${portfolio?.summary?.totalPnl >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
              ({portfolio?.summary?.totalPnlPct}%)
            </span>
          </div>
        </div>
      </div>

      {/* Holdings Table */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Your Holdings</h2>
        <div className="card glass p-0 overflow-hidden shadow-2xl">
          <table className="w-full text-left">
            <thead className="bg-bg-primary text-text-secondary text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Symbol</th>
                <th className="px-6 py-4 text-right">Qty</th>
                <th className="px-6 py-4 text-right">Avg Price</th>
                <th className="px-6 py-4 text-right">Curr Price</th>
                <th className="px-6 py-4 text-right">Profit / Loss</th>
                <th className="px-6 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-color">
              {portfolio?.holdings.length === 0 ? (
                <tr><td colSpan="6" className="text-center py-12 text-text-secondary">Your portfolio is empty</td></tr>
              ) : portfolio?.holdings.map((h) => (
                <tr key={h.stockSymbol} className="hover:bg-bg-primary/50 transition-colors">
                  <td className="px-6 py-4 font-bold text-accent-green uppercase">{h.stockSymbol.split('.')[0]}</td>
                  <td className="px-6 py-4 text-right font-mono">{h.quantity}</td>
                  <td className="px-6 py-4 text-right text-sm">₹{h.avgPrice.toFixed(2)}</td>
                  <td className="px-6 py-4 text-right text-sm font-bold">₹{h.currentPrice.toFixed(2)}</td>
                  <td className={`px-6 py-4 text-right font-bold ${h.pnl >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                    {h.pnl >= 0 ? '+' : ''}{h.pnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    <div className="text-[10px] opacity-80">{h.pnlPct}%</div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <Link 
                      to={`/stock/${h.stockSymbol}`}
                      className="text-xs font-bold text-text-secondary hover:text-accent-green uppercase transition-colors"
                    >
                      View Chart
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Recent Activity</h2>
        <div className="card glass p-0 overflow-hidden shadow-2xl">
          <table className="w-full text-left">
            <thead className="bg-bg-primary text-text-secondary text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Time</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Symbol</th>
                <th className="px-6 py-4 text-right">Qty</th>
                <th className="px-6 py-4 text-right">Price</th>
                <th className="px-6 py-4 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-color">
              {orders.length === 0 ? (
                <tr><td colSpan="6" className="text-center py-12 text-text-secondary">No recent transactions</td></tr>
              ) : orders.map((o) => (
                <tr key={o._id} className="hover:bg-bg-primary/50 transition-colors">
                  <td className="px-6 py-4 text-xs font-mono text-text-secondary">
                    {new Date(o.createdAt).toLocaleTimeString()}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${o.type === 'BUY' ? 'bg-accent-green/20 text-accent-green' : 'bg-accent-red/20 text-accent-red'}`}>
                      {o.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-bold uppercase">{o.stockSymbol.split('.')[0]}</td>
                  <td className="px-6 py-4 text-right font-mono">{o.quantity}</td>
                  <td className="px-6 py-4 text-right text-sm">₹{o.price.toFixed(2)}</td>
                  <td className="px-6 py-4 text-right text-sm font-bold">₹{o.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
