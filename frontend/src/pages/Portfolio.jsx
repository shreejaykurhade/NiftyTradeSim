import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useOrderSocket } from '../hooks/useSocket';
import MetricCard from '../components/MetricCard';
import EmptyState from '../components/EmptyState';
import { cleanSymbol, formatCurrency, formatPercent } from '../utils/format';

export default function Portfolio() {
  const { user, refreshUser } = useAuth();
  const [portfolio, setPortfolio] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchPortfolio = async () => {
    const { data } = await api.get('/portfolio');
    setPortfolio(data);
  };

  const fetchOrders = async () => {
    const { data } = await api.get('/orders');
    setOrders(data);
  };

  useEffect(() => {
    async function init() {
      try {
        await Promise.all([fetchPortfolio(), fetchOrders()]);
      } catch (err) {
        console.error('Portfolio load failed', err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  useOrderSocket(user?.id, () => {
    fetchPortfolio();
    fetchOrders();
    refreshUser();
  });

  const summary = portfolio?.summary || {};
  const pnlTone = Number(summary.totalPnl || 0) >= 0 ? 'positive' : 'negative';

  const allocation = useMemo(() => {
    const holdings = portfolio?.holdings || [];
    const total = holdings.reduce((sum, holding) => sum + Number(holding.currentPrice || 0) * Number(holding.quantity || 0), 0);
    return holdings
      .map((holding) => ({
        ...holding,
        weight: total ? ((Number(holding.currentPrice || 0) * Number(holding.quantity || 0)) / total) * 100 : 0,
      }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 6);
  }, [portfolio]);

  if (loading) {
    return <div className="py-24 text-center text-text-secondary">Loading portfolio...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="label">Portfolio</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Holdings and activity</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary">
            Review cash, current value, realized activity, and simulated exposure across your paper trading account.
          </p>
        </div>
        <Link to="/" className="btn-primary w-fit">Browse market</Link>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Available cash" value={formatCurrency(user?.balance, { maximumFractionDigits: 0, minimumFractionDigits: 0 })} tone="positive" />
        <MetricCard label="Total invested" value={formatCurrency(summary.totalInvested)} subvalue="Average cost basis" />
        <MetricCard label="Current value" value={formatCurrency(summary.totalCurrent)} tone="blue" subvalue="Marked to latest price" />
        <MetricCard label="Total P&L" value={formatCurrency(summary.totalPnl)} tone={pnlTone} subvalue={formatPercent(summary.totalPnlPct)} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <section className="surface overflow-hidden">
          <div className="border-b border-border-color p-5">
            <h2 className="text-lg font-semibold">Holdings</h2>
            <p className="mt-1 text-sm text-text-secondary">Open positions with live valuation and unrealized P&L.</p>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Avg price</th>
                  <th className="text-right">Current price</th>
                  <th className="text-right">P&L</th>
                  <th className="text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {portfolio?.holdings?.length ? (
                  portfolio.holdings.map((holding) => (
                    <tr key={holding.stockSymbol}>
                      <td>
                        <div className="font-semibold text-accent-green">{cleanSymbol(holding.stockSymbol)}</div>
                      </td>
                      <td className="text-right tabular-nums">{holding.quantity}</td>
                      <td className="text-right tabular-nums text-text-secondary">{formatCurrency(holding.avgPrice)}</td>
                      <td className="text-right font-semibold tabular-nums">{formatCurrency(holding.currentPrice)}</td>
                      <td className={`text-right font-semibold tabular-nums ${holding.pnl >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                        {formatCurrency(holding.pnl)}
                        <div className="text-xs">{formatPercent(holding.pnlPct)}</div>
                      </td>
                      <td className="text-center">
                        <Link to={`/stock/${holding.stockSymbol}`} className="btn-ghost px-3 py-2 text-xs text-accent-green">Trade</Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6">
                      <EmptyState
                        title="No holdings yet"
                        message="Open the market dashboard, choose a NIFTY 50 stock, and place your first paper trade."
                        action={<Link to="/" className="btn-primary">Find stocks</Link>}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="surface p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Allocation</h2>
            <span className="text-xs text-text-muted">Top positions</span>
          </div>
          <div className="mt-5 space-y-4">
            {allocation.length ? (
              allocation.map((holding) => (
                <div key={holding.stockSymbol}>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-semibold">{cleanSymbol(holding.stockSymbol)}</span>
                    <span className="tabular-nums text-text-secondary">{holding.weight.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-bg-primary">
                    <div className="h-full rounded-full bg-accent-green" style={{ width: `${Math.min(holding.weight, 100)}%` }} />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm leading-6 text-text-secondary">Allocation appears after your first holding.</p>
            )}
          </div>
        </aside>
      </div>

      <section className="surface overflow-hidden">
        <div className="border-b border-border-color p-5">
          <h2 className="text-lg font-semibold">Recent activity</h2>
          <p className="mt-1 text-sm text-text-secondary">Latest simulated executions from your account.</p>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Type</th>
                <th>Symbol</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Price</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.length ? (
                orders.map((order) => (
                  <tr key={order._id}>
                    <td className="text-xs tabular-nums text-text-secondary">{new Date(order.createdAt).toLocaleString()}</td>
                    <td>
                      <span className={`status-pill py-1 ${order.type === 'BUY' ? 'bg-accent-green/10 text-accent-green' : 'bg-accent-red/10 text-accent-red'}`}>
                        {order.type}
                      </span>
                    </td>
                    <td className="font-semibold">{cleanSymbol(order.stockSymbol)}</td>
                    <td className="text-right tabular-nums">{order.quantity}</td>
                    <td className="text-right tabular-nums">{formatCurrency(order.price)}</td>
                    <td className="text-right font-semibold tabular-nums">{formatCurrency(order.total)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6">
                    <EmptyState title="No recent transactions" message="Executions will appear here as soon as you place paper orders." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
