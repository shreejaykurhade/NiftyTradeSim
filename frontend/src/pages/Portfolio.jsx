import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useOrderSocket } from '../hooks/useSocket';
import MetricCard from '../components/MetricCard';
import EmptyState from '../components/EmptyState';
import { cleanSymbol, formatCurrency, formatPercent } from '../utils/format';

const COLORS = ['#16c784', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6', '#eab308', '#64748b'];

export default function Portfolio() {
  const { user, refreshUser } = useAuth();
  const [portfolio, setPortfolio] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('overview');

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
  const analytics = portfolio?.analytics || {};
  const holdings = portfolio?.holdings || [];
  const pnlTone = Number(summary.totalPnl || 0) >= 0 ? 'positive' : 'negative';

  const sortedHoldings = useMemo(
    () => [...holdings].sort((a, b) => Number(b.currentValue || 0) - Number(a.currentValue || 0)),
    [holdings]
  );

  if (loading) return <div className="py-24 text-center text-text-secondary">Loading portfolio...</div>;

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="label">Portfolio</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Holdings dashboard</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary">
            Track simulated investments, sector concentration, allocation risk, and execution history in one workspace.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to="/strategy-lab" className="btn-ghost">Strategy Lab</Link>
          <Link to="/" className="btn-primary">Browse market</Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Net worth" value={formatCurrency(summary.netWorth)} tone="blue" subvalue="Cash + holdings" />
        <MetricCard label="Available cash" value={formatCurrency(portfolio?.balance ?? user?.balance)} tone="positive" subvalue={`${analytics.cashWeight || 0}% cash`} />
        <MetricCard label="Invested value" value={formatCurrency(summary.totalCurrent)} subvalue={`${analytics.investedWeight || 0}% invested`} />
        <MetricCard label="Total invested" value={formatCurrency(summary.totalInvested)} subvalue="Cost basis" />
        <MetricCard label="Unrealized P&L" value={formatCurrency(summary.totalPnl)} tone={pnlTone} subvalue={formatPercent(summary.totalPnlPct)} />
      </section>

      <section className="surface p-2">
        <div className="flex flex-wrap gap-2">
          {[
            ['overview', 'Overview'],
            ['holdings', 'Holdings'],
            ['history', 'Trade history'],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveView(key)}
              className={`rounded-md px-4 py-2 text-sm font-bold ${activeView === key ? 'bg-accent-green text-bg-primary' : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {activeView === 'overview' && (
        <Overview
          holdings={sortedHoldings}
          summary={summary}
          analytics={analytics}
          orders={orders}
        />
      )}

      {activeView === 'holdings' && <HoldingsTable holdings={sortedHoldings} />}

      {activeView === 'history' && <TradeHistory orders={orders} />}
    </div>
  );
}

function Overview({ holdings, summary, analytics, orders }) {
  const sectorAllocation = analytics.sectorAllocation || [];
  const holdingAllocation = analytics.holdingAllocation || [];
  const recentOrders = orders.slice(0, 5);

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <section className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <AllocationCard
            title="Sector allocation"
            subtitle="Where your invested capital is concentrated"
            data={sectorAllocation}
            emptyMessage="Sector allocation appears after your first holding."
          />
          <AllocationCard
            title="Holding allocation"
            subtitle="Top stock weights inside your portfolio"
            data={holdingAllocation.map((item) => ({ ...item, label: cleanSymbol(item.symbol) }))}
            emptyMessage="Holding allocation appears after your first holding."
          />
        </div>

        <section className="surface overflow-hidden">
          <div className="flex items-center justify-between border-b border-border-color p-5">
            <div>
              <h2 className="text-lg font-semibold">Holdings snapshot</h2>
              <p className="mt-1 text-sm text-text-secondary">Largest positions and unrealized contribution.</p>
            </div>
            <Link to="#" onClick={(event) => event.preventDefault()} className="text-xs font-bold text-text-muted">
              {holdings.length} positions
            </Link>
          </div>
          <div className="grid gap-3 p-5 md:grid-cols-2">
            {holdings.length ? (
              holdings.slice(0, 6).map((holding) => <HoldingTile key={holding.stockSymbol} holding={holding} total={summary.totalCurrent} />)
            ) : (
              <div className="md:col-span-2">
                <EmptyState title="No holdings yet" message="Open a NIFTY 50 stock and place a paper trade to begin tracking allocation." action={<Link to="/" className="btn-primary">Find stocks</Link>} />
              </div>
            )}
          </div>
        </section>
      </section>

      <aside className="space-y-6">
        <section className="surface p-5">
          <h2 className="text-lg font-semibold">Risk concentration</h2>
          <div className="mt-5 space-y-4">
            <RiskRow label="Top sector" value={analytics.topSector?.label || '--'} weight={analytics.topSector?.weight || 0} />
            <RiskRow label="Top holding" value={analytics.topHolding ? cleanSymbol(analytics.topHolding.symbol) : '--'} weight={analytics.topHolding?.weight || 0} />
            <RiskRow label="Cash buffer" value="Cash" weight={analytics.cashWeight || 0} />
          </div>
        </section>

        <section className="surface overflow-hidden">
          <div className="border-b border-border-color p-5">
            <h2 className="text-lg font-semibold">Recent executions</h2>
            <p className="mt-1 text-sm text-text-secondary">History is separate from holdings.</p>
          </div>
          <div className="divide-y divide-border-color">
            {recentOrders.length ? (
              recentOrders.map((order) => <OrderRow key={order._id} order={order} />)
            ) : (
              <div className="p-5">
                <p className="text-sm text-text-secondary">No executions yet.</p>
              </div>
            )}
          </div>
        </section>
      </aside>
    </div>
  );
}

function AllocationCard({ title, subtitle, data, emptyMessage }) {
  const visible = data.slice(0, 7);

  return (
    <section className="surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>
        </div>
      </div>

      {visible.length ? (
        <div className="mt-6 grid gap-6 sm:grid-cols-[180px_1fr]">
          <DonutChart data={visible} />
          <div className="space-y-3">
            {visible.map((item, index) => (
              <div key={item.label || item.symbol} className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[index % COLORS.length] }} />
                  <span className="truncate text-sm font-semibold">{item.label}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums">{item.weight.toFixed(1)}%</p>
                  <p className="text-[11px] text-text-muted">{formatCurrency(item.value)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-6">
          <EmptyState title="No allocation yet" message={emptyMessage} />
        </div>
      )}
    </section>
  );
}

function DonutChart({ data }) {
  const radius = 76;
  const stroke = 24;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="relative grid place-items-center">
      <svg viewBox="0 0 190 190" className="h-[180px] w-[180px] -rotate-90">
        <circle cx="95" cy="95" r={radius} fill="none" stroke="rgba(34, 48, 68, 0.9)" strokeWidth={stroke} />
        {data.map((item, index) => {
          const dash = (item.weight / 100) * circumference;
          const segment = (
            <circle
              key={item.label || item.symbol}
              cx="95"
              cy="95"
              r={radius}
              fill="none"
              stroke={COLORS[index % COLORS.length]}
              strokeWidth={stroke}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            />
          );
          offset += dash;
          return segment;
        })}
      </svg>
      <div className="absolute text-center">
        <p className="text-2xl font-semibold">{data.length}</p>
        <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Groups</p>
      </div>
    </div>
  );
}

function HoldingTile({ holding, total }) {
  const weight = total > 0 ? (holding.currentValue / total) * 100 : 0;
  const isUp = Number(holding.pnl || 0) >= 0;

  return (
    <Link to={`/stock/${holding.stockSymbol}`} className="rounded-md border border-border-color bg-bg-secondary p-4 hover:border-accent-green/40">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-semibold text-text-primary">{cleanSymbol(holding.stockSymbol)}</p>
          <p className="mt-1 truncate text-xs text-text-muted">{holding.name}</p>
          <p className="mt-2 text-[11px] font-bold uppercase tracking-wider text-text-muted">{holding.sector}</p>
        </div>
        <div className="text-right">
          <p className="font-semibold tabular-nums">{formatCurrency(holding.currentValue)}</p>
          <p className={`text-xs font-bold tabular-nums ${isUp ? 'text-accent-green' : 'text-accent-red'}`}>
            {formatPercent(holding.pnlPct)}
          </p>
        </div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-bg-primary">
        <div className="h-full rounded-full bg-accent-green" style={{ width: `${Math.min(weight, 100)}%` }} />
      </div>
      <p className="mt-2 text-xs text-text-muted">{weight.toFixed(1)}% of invested portfolio</p>
    </Link>
  );
}

function HoldingsTable({ holdings }) {
  return (
    <section className="surface overflow-hidden">
      <div className="border-b border-border-color p-5">
        <h2 className="text-lg font-semibold">Holdings</h2>
        <p className="mt-1 text-sm text-text-secondary">Open positions with valuation, sector, day move, and unrealized P&L.</p>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Instrument</th>
              <th>Sector</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Avg price</th>
              <th className="text-right">LTP</th>
              <th className="text-right">Current value</th>
              <th className="text-right">Day</th>
              <th className="text-right">P&L</th>
              <th className="text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {holdings.length ? (
              holdings.map((holding) => {
                const isUp = Number(holding.pnl || 0) >= 0;
                const dayUp = Number(holding.dayChangePct || 0) >= 0;
                return (
                  <tr key={holding.stockSymbol}>
                    <td>
                      <div>
                        <Link to={`/stock/${holding.stockSymbol}`} className="font-semibold text-accent-green hover:text-text-primary">
                          {cleanSymbol(holding.stockSymbol)}
                        </Link>
                        <p className="mt-0.5 max-w-[240px] truncate text-xs text-text-muted">{holding.name}</p>
                      </div>
                    </td>
                    <td className="text-sm text-text-secondary">{holding.sector}</td>
                    <td className="text-right tabular-nums">{holding.quantity}</td>
                    <td className="text-right tabular-nums text-text-secondary">{formatCurrency(holding.avgPrice)}</td>
                    <td className="text-right font-semibold tabular-nums">{formatCurrency(holding.currentPrice)}</td>
                    <td className="text-right font-semibold tabular-nums">{formatCurrency(holding.currentValue)}</td>
                    <td className={`text-right font-semibold tabular-nums ${dayUp ? 'text-accent-green' : 'text-accent-red'}`}>
                      {formatPercent(holding.dayChangePct)}
                    </td>
                    <td className={`text-right font-semibold tabular-nums ${isUp ? 'text-accent-green' : 'text-accent-red'}`}>
                      {formatCurrency(holding.pnl)}
                      <div className="text-xs">{formatPercent(holding.pnlPct)}</div>
                    </td>
                    <td className="text-center">
                      <Link to={`/stock/${holding.stockSymbol}`} className="btn-ghost px-3 py-2 text-xs text-accent-green">Trade</Link>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="9">
                  <EmptyState title="No holdings yet" message="Open the market dashboard, choose a NIFTY 50 stock, and place your first paper trade." action={<Link to="/" className="btn-primary">Find stocks</Link>} />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TradeHistory({ orders }) {
  return (
    <section className="surface overflow-hidden">
      <div className="border-b border-border-color p-5">
        <h2 className="text-lg font-semibold">Trade history</h2>
        <p className="mt-1 text-sm text-text-secondary">Execution history is kept separate from active holdings.</p>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Type</th>
              <th>Order</th>
              <th>Symbol</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Price</th>
              <th className="text-right">Total</th>
              <th>Status</th>
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
                  <td className="text-sm text-text-secondary">{order.orderType || 'MARKET'}</td>
                  <td className="font-semibold">{cleanSymbol(order.stockSymbol)}</td>
                  <td className="text-right tabular-nums">{order.quantity}</td>
                  <td className="text-right tabular-nums">{formatCurrency(order.price)}</td>
                  <td className="text-right font-semibold tabular-nums">{formatCurrency(order.total)}</td>
                  <td className="text-sm text-text-secondary">{order.status || 'EXECUTED'}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8">
                  <EmptyState title="No trade history" message="Executions will appear here after buy or sell orders." />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RiskRow({ label, value, weight }) {
  const riskTone = weight >= 50 ? 'text-accent-red' : weight >= 30 ? 'text-accent-amber' : 'text-accent-green';

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{label}</p>
          <p className="text-xs text-text-muted">{value}</p>
        </div>
        <p className={`font-semibold tabular-nums ${riskTone}`}>{Number(weight || 0).toFixed(1)}%</p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-bg-primary">
        <div className="h-full rounded-full bg-current" style={{ width: `${Math.min(weight, 100)}%`, color: weight >= 50 ? '#ef4444' : weight >= 30 ? '#f59e0b' : '#16c784' }} />
      </div>
    </div>
  );
}

function OrderRow({ order }) {
  return (
    <div className="flex items-center justify-between gap-3 p-4">
      <div>
        <p className="font-semibold">{cleanSymbol(order.stockSymbol)}</p>
        <p className="mt-1 text-xs text-text-muted">{new Date(order.createdAt).toLocaleString()}</p>
      </div>
      <div className="text-right">
        <span className={`status-pill py-1 ${order.type === 'BUY' ? 'bg-accent-green/10 text-accent-green' : 'bg-accent-red/10 text-accent-red'}`}>
          {order.type}
        </span>
        <p className="mt-2 text-sm font-semibold tabular-nums">{formatCurrency(order.total)}</p>
      </div>
    </div>
  );
}
