import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import MetricCard from '../components/MetricCard';
import EmptyState from '../components/EmptyState';
import { cleanSymbol, compactVolume, formatCurrency, formatPercent } from '../utils/format';

const DEFAULT_PARAMS = {
  buy_and_hold: {},
  moving_average_crossover: { short_window: 20, long_window: 50 },
  rsi_mean_reversion: { period: 14, buy_below: 30, sell_above: 60 },
  breakout_momentum: { lookback: 20, exit_lookback: 10 },
};

export default function StrategyLab() {
  const [meta, setMeta] = useState({ strategies: {}, symbols: [] });
  const [symbol, setSymbol] = useState('RELIANCE.NS');
  const [strategy, setStrategy] = useState('buy_and_hold');
  const [startingCash, setStartingCash] = useState(1000000);
  const [positionSizePct, setPositionSizePct] = useState(1);
  const [feeRate, setFeeRate] = useState(0.001);
  const [params, setParams] = useState(DEFAULT_PARAMS.buy_and_hold);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadMeta() {
      try {
        const { data } = await api.get('/strategy-lab/strategies');
        setMeta(data);
        if (data.symbols?.[0]?.symbol) setSymbol(data.symbols[0].symbol);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load Strategy Lab');
      }
    }
    loadMeta();
  }, []);

  useEffect(() => {
    const nextParams = meta.strategies?.[strategy]?.params || DEFAULT_PARAMS[strategy] || {};
    setParams(nextParams);
  }, [strategy, meta.strategies]);

  const selectedStrategy = meta.strategies?.[strategy];
  const selectedInstrument = useMemo(
    () => meta.symbols.find((item) => item.symbol === symbol),
    [meta.symbols, symbol]
  );

  const runBacktest = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post(
        '/strategy-lab/backtest',
        {
          symbol,
          strategy,
          startingCash: Number(startingCash),
          positionSizePct: Number(positionSizePct),
          feeRate: Number(feeRate),
          params,
        },
        { timeout: 60000 }
      );
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Backtest failed');
    } finally {
      setLoading(false);
    }
  };

  const recentTrades = useMemo(() => (result?.trades || []).slice(-8).reverse(), [result]);
  const returnTone = Number(result?.metrics?.total_return_pct || 0) >= 0 ? 'positive' : 'negative';

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="label">Strategy Lab</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Backtest quant techniques</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary">
            Run framework strategies on historical NIFTY 50 candles and compare investment outcomes before paper trading.
          </p>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <form onSubmit={runBacktest} className="surface p-5">
          <h2 className="text-lg font-semibold">Experiment setup</h2>
          <p className="mt-1 text-sm text-text-secondary">Choose the symbol, strategy, capital, sizing, costs, and parameters.</p>

          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-semibold text-text-secondary">Instrument</label>
              <select value={symbol} onChange={(event) => setSymbol(event.target.value)}>
                {meta.symbols.map((item) => (
                  <option key={item.symbol} value={item.symbol}>
                    {cleanSymbol(item.symbol)} - {item.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedInstrument && <InstrumentCard instrument={selectedInstrument} />}

            <div>
              <label className="mb-2 block text-sm font-semibold text-text-secondary">Strategy</label>
              <select value={strategy} onChange={(event) => setStrategy(event.target.value)}>
                {Object.entries(meta.strategies).map(([key, item]) => (
                  <option key={key} value={key}>
                    {item.label}
                  </option>
                ))}
              </select>
              {selectedStrategy && (
                <p className="mt-2 text-xs leading-5 text-text-muted">{selectedStrategy.description}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <NumberField label="Starting cash" value={startingCash} onChange={setStartingCash} min="10000" step="10000" />
              <NumberField label="Position size" value={positionSizePct} onChange={setPositionSizePct} min="0.05" max="1" step="0.05" />
              <NumberField label="Fee rate" value={feeRate} onChange={setFeeRate} min="0" step="0.0005" />
              <NumberField label="Candles" value={1250} disabled />
            </div>

            {Object.keys(params).length > 0 && (
              <div className="rounded-md border border-border-color bg-bg-secondary p-4">
                <p className="label">Strategy parameters</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {Object.entries(params).map(([key, value]) => (
                    <NumberField
                      key={key}
                      label={key.replaceAll('_', ' ')}
                      value={value}
                      onChange={(next) => setParams((current) => ({ ...current, [key]: Number(next) }))}
                      step="1"
                    />
                  ))}
                </div>
              </div>
            )}

            {error && <div className="rounded-md border border-accent-red/30 bg-accent-red/10 p-3 text-sm text-accent-red">{error}</div>}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Running backtest...' : 'Run backtest'}
            </button>
          </div>
        </form>

        <section className="space-y-6">
          {result ? (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Final value" value={formatCurrency(result.finalValue)} tone={returnTone} />
                <MetricCard label="Total return" value={formatPercent(result.metrics?.total_return_pct)} tone={returnTone} />
                <MetricCard label="Max drawdown" value={formatPercent(result.metrics?.max_drawdown_pct)} tone="negative" />
                <MetricCard label="Trades" value={result.metrics?.trade_count || 0} subvalue={`${result.candleCount} candles tested`} />
              </div>

              <div className="surface overflow-hidden">
                <div className="border-b border-border-color p-5">
                  <h2 className="text-lg font-semibold">Equity curve</h2>
                  <p className="mt-1 text-sm text-text-secondary">
                    {cleanSymbol(result.symbol)} using {result.strategyMeta?.label}
                  </p>
                </div>
                <EquityCurve points={result.equityCurve || []} />
              </div>

              <div className="surface overflow-hidden">
                <div className="border-b border-border-color p-5">
                  <h2 className="text-lg font-semibold">Recent simulated trades</h2>
                  <p className="mt-1 text-sm text-text-secondary">Latest fills generated by the backtest engine.</p>
                </div>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Index</th>
                        <th>Side</th>
                        <th className="text-right">Qty</th>
                        <th className="text-right">Price</th>
                        <th className="text-right">Fee</th>
                        <th className="text-right">Net total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentTrades.length ? (
                        recentTrades.map((trade, index) => (
                          <tr key={`${trade.index}-${trade.side}-${index}`}>
                            <td className="tabular-nums text-text-secondary">{trade.index}</td>
                            <td>
                              <span className={`status-pill py-1 ${trade.side === 'BUY' ? 'bg-accent-green/10 text-accent-green' : 'bg-accent-red/10 text-accent-red'}`}>
                                {trade.side}
                              </span>
                            </td>
                            <td className="text-right tabular-nums">{trade.quantity}</td>
                            <td className="text-right tabular-nums">{formatCurrency(trade.price)}</td>
                            <td className="text-right tabular-nums">{formatCurrency(trade.fee)}</td>
                            <td className="text-right font-semibold tabular-nums">{formatCurrency(trade.net_total)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="6">
                            <EmptyState title="No trades generated" message="This strategy did not produce an entry or exit for the selected data." />
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="surface">
              <EmptyState
                title="Run a backtest to see results"
                message="The Strategy Lab connects directly to the quant framework, runs the selected strategy, and reports simulated investment performance."
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function InstrumentCard({ instrument }) {
  const isUp = Number(instrument.changePct || 0) >= 0;

  return (
    <div className="rounded-md border border-border-color bg-bg-secondary p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-semibold text-text-primary">{cleanSymbol(instrument.symbol)}</p>
          <p className="mt-1 text-sm text-text-secondary">{instrument.name}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="status-pill bg-white/5 py-1 text-text-secondary">{instrument.sector}</span>
            <span className={`status-pill py-1 ${instrument.isMarketOpen ? 'bg-accent-green/10 text-accent-green' : 'bg-accent-red/10 text-accent-red'}`}>
              {instrument.isMarketOpen ? 'Live' : 'Closed'}
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xl font-semibold tabular-nums">
            {instrument.price ? formatCurrency(instrument.price) : '--'}
          </p>
          <p className={`mt-1 text-xs font-bold tabular-nums ${isUp ? 'text-accent-green' : 'text-accent-red'}`}>
            {instrument.changePct !== null && instrument.changePct !== undefined ? formatPercent(instrument.changePct) : '--'}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <QuoteStat label="Open" value={instrument.open ? formatCurrency(instrument.open) : '--'} />
        <QuoteStat label="High" value={instrument.high ? formatCurrency(instrument.high) : '--'} tone="text-accent-green" />
        <QuoteStat label="Low" value={instrument.low ? formatCurrency(instrument.low) : '--'} tone="text-accent-red" />
        <QuoteStat label="Volume" value={compactVolume(instrument.volume)} />
        <QuoteStat label="Change" value={instrument.change ? formatCurrency(instrument.change) : '--'} tone={isUp ? 'text-accent-green' : 'text-accent-red'} />
        <QuoteStat label="Symbol" value={cleanSymbol(instrument.symbol)} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Link to={`/stock/${instrument.symbol}`} className="btn-primary py-2 text-sm">
          Open stock details
        </Link>
        {instrument.website ? (
          <a href={instrument.website} target="_blank" rel="noreferrer" className="btn-ghost py-2 text-sm">
            Company site
          </a>
        ) : (
          <span className="btn-ghost py-2 text-sm opacity-50">No website</span>
        )}
      </div>
    </div>
  );
}

function QuoteStat({ label, value, tone = 'text-text-primary' }) {
  return (
    <div className="rounded-md border border-border-color bg-bg-primary p-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">{label}</p>
      <p className={`mt-1 truncate font-semibold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

function NumberField({ label, value, onChange, disabled = false, ...props }) {
  return (
    <div>
      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-text-muted">{label}</label>
      <input
        type="number"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.value)}
        {...props}
      />
    </div>
  );
}

function EquityCurve({ points }) {
  if (!points.length) {
    return <EmptyState title="No equity data" message="The backtest returned no equity curve points." />;
  }

  const width = 920;
  const height = 260;
  const values = points.map((point) => Number(point.value));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / Math.max(points.length - 1, 1);
  const path = points
    .map((point, index) => {
      const x = index * step;
      const y = height - ((Number(point.value) - min) / span) * height;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <div className="p-5">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[260px] w-full overflow-visible">
        <path d={path} fill="none" stroke="#16c784" strokeWidth="3" strokeLinecap="round" />
        <path d={`${path} L ${width} ${height} L 0 ${height} Z`} fill="rgba(22, 199, 132, 0.08)" />
      </svg>
      <div className="mt-3 flex justify-between text-xs text-text-muted">
        <span>{formatCurrency(min)}</span>
        <span>{formatCurrency(max)}</span>
      </div>
    </div>
  );
}
