import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useMarketSocket } from '../hooks/useSocket';
import MetricCard from '../components/MetricCard';
import EmptyState from '../components/EmptyState';
import { cleanSymbol, compactVolume, formatCurrency, formatPercent } from '../utils/format';

export default function Dashboard() {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('symbol');

  useEffect(() => {
    async function fetchStocks() {
      try {
        const { data } = await api.get('/market/stocks');
        setStocks(data);
      } catch (err) {
        console.error('Failed to fetch stocks', err);
      } finally {
        setLoading(false);
      }
    }
    fetchStocks();
  }, []);

  useMarketSocket((updates) => {
    setStocks((prev) => {
      const next = [...prev];
      updates.forEach((update) => {
        const idx = next.findIndex((stock) => stock.symbol === update.symbol);
        if (idx !== -1) {
          const previousPrice = next[idx].price;
          next[idx] = {
            ...next[idx],
            ...update,
            flash: update.price > previousPrice ? 'up' : update.price < previousPrice ? 'down' : null,
          };
        }
      });
      return next;
    });
  });

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const result = stocks.filter((stock) => {
      if (!query) return true;
      return stock.name?.toLowerCase().includes(query) || stock.symbol?.toLowerCase().includes(query);
    });

    return [...result].sort((a, b) => {
      if (sortBy === 'gainers') return (b.changePct || 0) - (a.changePct || 0);
      if (sortBy === 'losers') return (a.changePct || 0) - (b.changePct || 0);
      if (sortBy === 'volume') return (b.volume || 0) - (a.volume || 0);
      return cleanSymbol(a.symbol).localeCompare(cleanSymbol(b.symbol));
    });
  }, [search, sortBy, stocks]);

  const marketStats = useMemo(() => {
    const priced = stocks.filter((stock) => Number(stock.price));
    const gainers = priced.filter((stock) => Number(stock.changePct) >= 0);
    const losers = priced.length - gainers.length;
    const topMover = [...priced].sort((a, b) => Math.abs(b.changePct || 0) - Math.abs(a.changePct || 0))[0];
    const totalVolume = priced.reduce((sum, stock) => sum + Number(stock.volume || 0), 0);

    return {
      gainers: gainers.length,
      losers,
      topMover,
      totalVolume,
      live: stocks.some((stock) => stock.isMarketOpen),
    };
  }, [stocks]);

  const topGainers = useMemo(
    () => [...stocks].filter((s) => Number(s.price)).sort((a, b) => (b.changePct || 0) - (a.changePct || 0)).slice(0, 5),
    [stocks]
  );

  const topLosers = useMemo(
    () => [...stocks].filter((s) => Number(s.price)).sort((a, b) => (a.changePct || 0) - (b.changePct || 0)).slice(0, 5),
    [stocks]
  );

  return (
    <div className="space-y-6">
      <section className="surface overflow-hidden">
        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_360px] lg:p-7">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className={`status-pill ${marketStats.live ? 'bg-accent-green/10 text-accent-green' : 'bg-accent-red/10 text-accent-red'}`}>
                <span className={`h-2 w-2 rounded-full ${marketStats.live ? 'bg-accent-green animate-pulse' : 'bg-accent-red'}`} />
                {marketStats.live ? 'Market Live' : 'Market Closed'}
              </span>
              <span className="status-pill bg-white/5 text-text-secondary">NSE paper trading simulator</span>
            </div>
            <h1 className="mt-6 max-w-3xl text-3xl font-semibold tracking-tight text-text-primary md:text-5xl">
              NIFTY 50 market dashboard
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-text-secondary">
              Track live prices, scan movers, compare volume, and open a focused trade workspace for any index stock.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <MetricCard label="Advancers" value={marketStats.gainers} tone="positive" subvalue={`${marketStats.losers} declining`} />
            <MetricCard label="Universe" value={stocks.length || '--'} subvalue="NIFTY 50 stocks" />
            <MetricCard label="Top mover" value={marketStats.topMover ? cleanSymbol(marketStats.topMover.symbol) : '--'} tone={Number(marketStats.topMover?.changePct) >= 0 ? 'positive' : 'negative'} subvalue={marketStats.topMover ? formatPercent(marketStats.topMover.changePct) : 'Waiting for feed'} />
            <MetricCard label="Volume" value={compactVolume(marketStats.totalVolume)} tone="blue" subvalue="Combined feed" />
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <section className="surface overflow-hidden">
          <div className="flex flex-col gap-4 border-b border-border-color p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">NIFTY 50 stocks</h2>
              <p className="mt-1 text-sm text-text-secondary">Sortable, searchable watchlist with live WebSocket ticks.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-[minmax(220px,320px)_150px]">
              <input
                type="search"
                placeholder="Search symbol or company"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                <option value="symbol">Symbol</option>
                <option value="gainers">Top gainers</option>
                <option value="losers">Top losers</option>
                <option value="volume">Volume</option>
              </select>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Instrument</th>
                  <th className="text-right">Open</th>
                  <th className="text-right">Day range</th>
                  <th className="text-right">Last price</th>
                  <th className="text-right">Change</th>
                  <th className="text-right">Volume</th>
                  <th className="text-center">Trade</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="py-14 text-center text-text-secondary">Loading market data...</td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-14">
                      <EmptyState title="No stocks found" message="Try a different symbol, company name, or reset the filter." />
                    </td>
                  </tr>
                ) : (
                  filtered.map((stock) => {
                    const isUp = Number(stock.changePct) >= 0;
                    return (
                      <tr key={stock.symbol}>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="grid h-10 w-10 place-items-center rounded-md bg-bg-soft text-xs font-black text-accent-green">
                              {cleanSymbol(stock.symbol).slice(0, 3)}
                            </div>
                            <div>
                              <Link to={`/stock/${stock.symbol}`} className="font-semibold text-text-primary hover:text-accent-green">
                                {cleanSymbol(stock.symbol)}
                              </Link>
                              <p className="mt-0.5 max-w-[280px] truncate text-xs text-text-muted">{stock.name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="text-right tabular-nums text-text-secondary">{stock.open ? formatCurrency(stock.open) : '--'}</td>
                        <td className="text-right tabular-nums text-xs">
                          <span className="text-accent-red">{stock.low ? formatCurrency(stock.low, { maximumFractionDigits: 1, minimumFractionDigits: 1 }) : '--'}</span>
                          <span className="mx-2 text-text-muted">to</span>
                          <span className="text-accent-green">{stock.high ? formatCurrency(stock.high, { maximumFractionDigits: 1, minimumFractionDigits: 1 }) : '--'}</span>
                        </td>
                        <td className={`text-right font-semibold tabular-nums ${stock.flash === 'up' ? 'text-accent-green' : stock.flash === 'down' ? 'text-accent-red' : 'text-text-primary'}`}>
                          {stock.price ? formatCurrency(stock.price) : '--'}
                        </td>
                        <td className={`text-right font-semibold tabular-nums ${isUp ? 'text-accent-green' : 'text-accent-red'}`}>
                          {formatPercent(stock.changePct)}
                        </td>
                        <td className="text-right tabular-nums text-text-secondary">{compactVolume(stock.volume)}</td>
                        <td className="text-center">
                          <Link to={`/stock/${stock.symbol}`} className="btn-ghost px-3 py-2 text-xs text-accent-green">
                            Open
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="space-y-6">
          <section className="surface p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Top gainers</h3>
              <span className="text-xs text-text-muted">Today</span>
            </div>
            <div className="mt-4 space-y-3">
              {topGainers.map((stock) => (
                <MoverRow key={stock.symbol} stock={stock} />
              ))}
            </div>
          </section>

          <section className="surface p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Top losers</h3>
              <span className="text-xs text-text-muted">Today</span>
            </div>
            <div className="mt-4 space-y-3">
              {topLosers.map((stock) => (
                <MoverRow key={stock.symbol} stock={stock} />
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function MoverRow({ stock }) {
  const isUp = Number(stock.changePct) >= 0;

  return (
    <Link to={`/stock/${stock.symbol}`} className="flex items-center justify-between rounded-md border border-border-color bg-bg-secondary p-3 hover:border-accent-green/40">
      <div>
        <p className="text-sm font-semibold">{cleanSymbol(stock.symbol)}</p>
        <p className="mt-0.5 max-w-[180px] truncate text-xs text-text-muted">{stock.name}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold tabular-nums">{formatCurrency(stock.price)}</p>
        <p className={`text-xs font-bold tabular-nums ${isUp ? 'text-accent-green' : 'text-accent-red'}`}>{formatPercent(stock.changePct)}</p>
      </div>
    </Link>
  );
}
