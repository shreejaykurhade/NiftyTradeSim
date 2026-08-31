import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import MetricCard from '../components/MetricCard';
import EmptyState from '../components/EmptyState';
import { cleanSymbol, formatCurrency, formatPercent } from '../utils/format';

const TECHNICAL_AXES = ['Price', 'Volume', 'Volatility', 'Momentum', 'Technical Macro'];
const PERCEPTION_AXES = ['Domestic Market', 'Peers', 'International Market', 'News / Events', 'Time Regime'];

export default function AgentTrading() {
  const [stocks, setStocks] = useState([]);
  const [symbol, setSymbol] = useState('RELIANCE.NS');
  const [activeView, setActiveView] = useState('runner');
  const [simulation, setSimulation] = useState(null);
  const [memory, setMemory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestedSymbol = useMemo(() => new URLSearchParams(window.location.search).get('symbol'), []);

  useEffect(() => {
    async function loadStocks() {
      try {
        const { data } = await api.get('/market/stocks');
        const tradable = data.filter((stock) => stock.sector !== 'Index');
        setStocks(tradable);
        const requested = tradable.find((stock) => stock.symbol === requestedSymbol);
        if (requested?.symbol) setSymbol(requested.symbol);
        else if (tradable[0]?.symbol) setSymbol(tradable[0].symbol);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load instruments');
      }
    }
    loadStocks();
  }, [requestedSymbol]);

  const selectedStock = useMemo(() => stocks.find((stock) => stock.symbol === symbol), [stocks, symbol]);

  useEffect(() => {
    async function loadMemory() {
      if (!symbol) return;
      try {
        const { data } = await api.get(`/agents/memory?symbol=${encodeURIComponent(symbol)}`);
        setMemory(data);
      } catch {
        setMemory(null);
      }
    }
    loadMemory();
  }, [symbol]);

  const runAgentSimulation = async () => {
    setLoading(true);
    setError('');
    setSimulation({ logs: [] });

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/agents/simulation/${symbol}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error(`Agent simulation failed with HTTP ${response.status}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop();

        for (const part of parts) {
          if (!part.startsWith('data: ')) continue;
          const parsed = JSON.parse(part.slice(6));
          if (parsed.type === 'log') {
            setSimulation((prev) => ({ ...prev, logs: [...(prev?.logs || []), parsed.log] }));
          }
          if (parsed.type === 'result') {
            setSimulation((prev) => ({ ...prev, ...parsed.data, logs: prev?.logs || [] }));
            if (parsed.data.memory) setMemory(parsed.data.memory);
          }
        }
      }
      const { data } = await api.get(`/agents/memory?symbol=${encodeURIComponent(symbol)}`);
      setMemory(data);
    } catch (err) {
      setError(err.message || 'Agent simulation failed');
    } finally {
      setLoading(false);
    }
  };

  const actionTone = getActionTone(simulation?.action);

  return (
    <div className="space-y-6">
      <section className="surface overflow-hidden">
        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_360px] lg:p-7">
          <div>
            <p className="label">Agent Trading</p>
            <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight md:text-5xl">
              Monte Carlo agent network for paper-trade decisions
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-text-secondary">
              Run a multi-agent simulation that combines technical price action with perception context from domestic markets, peers, international cues, news/events, and time regime before producing paper-trade guidance.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MetricCard label="Agents" value="10D" tone="blue" subvalue="Technical + perception" />
            <MetricCard label="Engine" value="Monte Carlo" subvalue="Regime-conditioned bootstrap" />
            <MetricCard label="Actions" value="B/H/S" tone="amber" subvalue="Buy Hold Sell" />
            <MetricCard label="Mode" value="Paper" tone="positive" subvalue="No real money" />
          </div>
        </div>
      </section>

      <section className="surface p-2">
        <div className="flex flex-wrap gap-2">
          {[
            ['overview', 'Overview'],
            ['runner', 'Agent runner'],
            ['framework', 'Framework'],
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

      {activeView === 'overview' && <AgentOverview />}

      {activeView === 'runner' && (
        <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
          <section className="surface p-5">
            <h2 className="text-lg font-semibold">Simulation setup</h2>
            <p className="mt-1 text-sm text-text-secondary">Select an instrument and run the agent network before opening a trade.</p>

            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-text-secondary">Instrument</label>
                <select value={symbol} onChange={(event) => setSymbol(event.target.value)}>
                  {stocks.map((stock) => (
                    <option key={stock.symbol} value={stock.symbol}>
                      {cleanSymbol(stock.symbol)} - {stock.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedStock && <StockContext stock={selectedStock} />}
              <MemorySummary memory={memory} />

              {error && <div className="rounded-md border border-accent-red/30 bg-accent-red/10 p-3 text-sm text-accent-red">{error}</div>}

              <button onClick={runAgentSimulation} disabled={loading} className="btn-primary w-full">
                {loading ? 'Running agent network...' : 'Run agent simulation'}
              </button>
            </div>
          </section>

          <section className="space-y-6">
            {simulation ? (
              <>
                <div className="grid gap-4 md:grid-cols-3">
                  <MetricCard label="Agent action" value={simulation.action || 'Running'} tone={actionTone} />
                  <MetricCard label="Decision strength" value={`${simulation.consensus_score ?? '--'}%`} tone={actionTone} />
                  <MetricCard label="State axes" value={stateAxisCount(simulation)} subvalue="10D state" />
                  <MetricCard label="Memory" value={formatSigned(simulation.memory_adjustment)} subvalue="Calibration" />
                </div>

                <section className="surface p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold">Decision panel</h2>
                      <p className="mt-1 text-sm text-text-secondary">Agent output is decision support. Place trades manually from stock details.</p>
                    </div>
                    <Link to={`/stock/${symbol}`} className="btn-primary w-fit">Open trade ticket</Link>
                  </div>

                  {simulation.reasoning && (
                    <p className="mt-5 rounded-md border border-border-color bg-bg-secondary p-4 text-sm leading-6 text-text-secondary">
                      {simulation.reasoning}
                    </p>
                  )}

                  {(simulation.technical_vector || simulation.vector) && (
                    <div className="mt-5 grid gap-4 xl:grid-cols-2">
                      <VectorPanel
                        title="Technical 5D"
                        subtitle="Price, participation, volatility, trend, and market proxy"
                        vector={simulation.technical_vector || simulation.vector}
                        axes={TECHNICAL_AXES}
                      />
                      <VectorPanel
                        title="Perception 5D"
                        subtitle="Market context, peers, global risk, news, and time regime"
                        vector={simulation.perception_vector || []}
                        axes={PERCEPTION_AXES}
                      />
                    </div>
                  )}

                  {(simulation.technical_weight !== undefined || simulation.perception_weight !== undefined) && (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <SignalWeight label="Technical weight" value={simulation.technical_weight} />
                      <SignalWeight label="Perception weight" value={simulation.perception_weight} />
                      <SignalWeight label="Memory calibration" value={simulation.memory_adjustment} />
                    </div>
                  )}

                  {simulation.monte_carlo && <MonteCarloPanel result={simulation.monte_carlo} />}
                </section>

                <section className="surface overflow-hidden">
                  <div className="border-b border-border-color p-5">
                    <h2 className="text-lg font-semibold">Agent event stream</h2>
                    <p className="mt-1 text-sm text-text-secondary">Live pipeline logs from market, context, memory, risk, and trader stages.</p>
                  </div>
                  <AgentLog logs={simulation.logs || []} loading={loading} />
                </section>

                <ScenarioGrid scenarios={simulation.scenarios || []} />
                <MemoryPanel memory={memory || simulation.memory} />
              </>
            ) : (
              <section className="surface">
                <EmptyState
                  title="Run an agent simulation"
                  message="The network will stream each agent step, produce a 10D technical and perception state vector, and show an action with confidence."
                />
              </section>
            )}
          </section>
        </div>
      )}

      {activeView === 'framework' && <FrameworkView />}
    </div>
  );
}

function StockContext({ stock }) {
  const isUp = Number(stock.changePct || 0) >= 0;

  return (
    <div className="rounded-md border border-border-color bg-bg-secondary p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold text-text-primary">{cleanSymbol(stock.symbol)}</p>
          <p className="mt-1 text-sm text-text-secondary">{stock.name}</p>
          <p className="mt-2 text-xs font-bold uppercase tracking-wider text-text-muted">{stock.sector}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold tabular-nums">{stock.price ? formatCurrency(stock.price) : '--'}</p>
          <p className={`text-xs font-bold tabular-nums ${isUp ? 'text-accent-green' : 'text-accent-red'}`}>
            {stock.changePct !== undefined ? formatPercent(stock.changePct) : '--'}
          </p>
        </div>
      </div>
    </div>
  );
}

function MemorySummary({ memory }) {
  if (!memory) {
    return (
      <div className="rounded-md border border-border-color bg-bg-secondary p-4 text-sm text-text-secondary">
        Loading agent memory...
      </div>
    );
  }

  const accuracy = memory.accuracy === null || memory.accuracy === undefined
    ? 'Learning'
    : `${Math.round(memory.accuracy * 100)}%`;

  return (
    <div className="rounded-md border border-border-color bg-bg-secondary p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-text-muted">Agent memory</p>
          <p className="mt-1 text-sm text-text-secondary">
            {memory.enabled ? `${memory.total_runs || 0} prior runs tracked` : 'Memory disabled until MongoDB is available'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold tabular-nums">{accuracy}</p>
          <p className="text-xs text-text-muted">{memory.evaluated_runs || 0} evaluated</p>
        </div>
      </div>
    </div>
  );
}

function VectorPanel({ title, subtitle, vector, axes }) {
  return (
    <div className="rounded-md border border-border-color bg-bg-secondary p-4">
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-1 text-xs text-text-muted">{subtitle}</p>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-5">
      {vector.map((value, index) => {
        const numeric = Number(value || 0);
        const width = Math.min(Math.abs(numeric) * 100, 100);
        return (
          <div key={axes[index]} className="rounded-md border border-border-color bg-bg-primary p-3">
            <p className="text-xs font-bold uppercase tracking-wider text-text-muted">{axes[index]}</p>
            <p className={`mt-2 text-lg font-semibold tabular-nums ${numeric >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
              {numeric >= 0 ? '+' : ''}{numeric.toFixed(2)}
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-bg-secondary">
              <div
                className={numeric >= 0 ? 'h-full rounded-full bg-accent-green' : 'h-full rounded-full bg-accent-red'}
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
      {!vector.length && (
        <div className="rounded-md border border-border-color bg-bg-primary p-3 text-sm text-text-secondary">
          Waiting for perception signals.
        </div>
      )}
      </div>
    </div>
  );
}

function SignalWeight({ label, value }) {
  const numeric = Number(value || 0);
  const tone = numeric >= 0 ? 'text-accent-green' : 'text-accent-red';

  return (
    <div className="rounded-md border border-border-color bg-bg-secondary p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-text-muted">{label}</p>
      <p className={`mt-2 text-xl font-semibold tabular-nums ${tone}`}>
        {numeric >= 0 ? '+' : ''}{numeric.toFixed(2)}
      </p>
    </div>
  );
}

function MonteCarloPanel({ result }) {
  const diagnostics = result.diagnostics || {};
  const metrics = [
    ['Expected return', `${formatSigned(result.expected_return_pct)}%`],
    ['Median return', `${formatSigned(result.median_return_pct)}%`],
    ['Profit probability', `${Number(result.probability_profit_pct || 0).toFixed(1)}%`],
    ['VaR 95%', `${formatSigned(result.value_at_risk_95_pct)}%`],
    ['Expected shortfall 95%', `${formatSigned(result.expected_shortfall_95_pct)}%`],
    ['Expected max drawdown', `${formatSigned(result.expected_max_drawdown_pct)}%`],
  ];

  return (
    <div className="mt-5 rounded-md border border-border-color bg-bg-secondary p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-semibold">Monte Carlo risk distribution</h3>
          <p className="mt-1 text-xs leading-5 text-text-muted">
            {Number(diagnostics.simulations || 0).toLocaleString()} paths · {diagnostics.horizon_days || '--'} sessions · {diagnostics.effective_neighbors || '--'} effective regimes
          </p>
        </div>
        <span className="rounded-md bg-bg-primary px-3 py-2 text-xs font-bold text-accent-blue">
          {diagnostics.policy_status === 'RESEARCH_ONLY' ? 'Research only · Not RL' : 'Validated policy'}
        </span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map(([label, value]) => (
          <div key={label} className="rounded-md border border-border-color bg-bg-primary p-3">
            <p className="text-xs font-bold uppercase tracking-wider text-text-muted">{label}</p>
            <p className="mt-2 text-lg font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs leading-5 text-text-muted">
        Distributional estimate from historical analog regimes after estimated costs. It is not a guarantee, calibrated win rate, or live-capital authorization.
      </p>
    </div>
  );
}

function MemoryPanel({ memory }) {
  if (!memory?.enabled) return null;

  return (
    <section className="surface p-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Agent memory</h2>
          <p className="mt-1 text-sm text-text-secondary">Previous decisions are evaluated against later prices and used as a small calibration signal.</p>
        </div>
        <span className="rounded-md bg-bg-secondary px-3 py-2 text-sm font-bold tabular-nums text-accent-blue">
          {formatSigned(memory.memory_adjustment)} adjustment
        </span>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-border-color bg-bg-secondary p-4">
          <h3 className="font-semibold">Recent mistakes</h3>
          <div className="mt-3 space-y-3">
            {memory.recent_mistakes?.length ? memory.recent_mistakes.map((item, index) => (
              <div key={`${item.created_at}-${index}`} className="rounded-md bg-bg-primary p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-bold">{item.action}</span>
                  <span className={Number(item.return_pct || 0) >= 0 ? 'text-sm font-bold text-accent-green' : 'text-sm font-bold text-accent-red'}>
                    {formatSigned(item.return_pct)}%
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-text-secondary">{item.note}</p>
              </div>
            )) : (
              <p className="text-sm text-text-secondary">No evaluated mistakes yet. Run the agent over time so it can compare calls against later prices.</p>
            )}
          </div>
        </div>

        <div className="rounded-md border border-border-color bg-bg-secondary p-4">
          <h3 className="font-semibold">Last runs</h3>
          <div className="mt-3 space-y-2">
            {memory.last_runs?.length ? memory.last_runs.map((item, index) => (
              <div key={`${item.created_at}-${index}`} className="grid grid-cols-[1fr_auto] gap-3 rounded-md bg-bg-primary p-3 text-sm">
                <div>
                  <p className="font-bold">{item.action} · {item.consensus_score}%</p>
                  <p className="mt-1 text-xs text-text-muted">{new Date(item.created_at).toLocaleString()}</p>
                </div>
                <div className="text-right text-xs text-text-secondary">
                  <p>{item.outcome?.status || 'PENDING'}</p>
                  {item.outcome?.returnPct !== null && item.outcome?.returnPct !== undefined && (
                    <p className={Number(item.outcome.returnPct) >= 0 ? 'text-accent-green' : 'text-accent-red'}>
                      {formatSigned(item.outcome.returnPct)}%
                    </p>
                  )}
                </div>
              </div>
            )) : (
              <p className="text-sm text-text-secondary">No previous runs for this symbol yet.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function AgentLog({ logs, loading }) {
  return (
    <div className="max-h-[420px] overflow-y-auto bg-[#060910] p-5 font-mono text-xs">
      {logs.length ? (
        logs.map((log, index) => (
          <div key={`${log.agent}-${index}`} className="grid gap-3 border-b border-border-color/50 py-3 sm:grid-cols-[170px_1fr]">
            <span className="text-text-muted">[{log.agent}]</span>
            <span className={classifyLog(log.message)}>{log.message}</span>
          </div>
        ))
      ) : (
        <p className="text-text-secondary">{loading ? 'Waiting for first agent event...' : 'No logs yet.'}</p>
      )}
    </div>
  );
}

function ScenarioGrid({ scenarios }) {
  if (!scenarios.length) return null;

  return (
    <section className="grid gap-4 md:grid-cols-3">
      {scenarios.map((scenario) => (
        <article key={scenario.name} className="surface p-5">
          <div className="flex items-start justify-between gap-4">
            <h3 className="font-semibold">{scenario.name}</h3>
            <span className="rounded-md bg-bg-secondary px-2 py-1 text-xs font-bold text-accent-blue">
              {Number(scenario.probability || 0).toFixed(0)}%
            </span>
          </div>
          <p className="mt-4 text-sm leading-6 text-text-secondary">{scenario.catalyst}</p>
          {scenario.projected_return !== undefined && (
            <p className="mt-3 text-xl font-semibold tabular-nums">{formatSigned(scenario.projected_return)}%</p>
          )}
        </article>
      ))}
    </section>
  );
}

function AgentOverview() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {[
        ['Technical 5D', 'Price, volume, volatility, momentum, and technical macro agents convert raw candles into normalized market features.'],
        ['Perception 5D', 'Domestic market, peers, international market, news/events, and time regime agents add context that can affect the stock or sector.'],
        ['Risk + policy layer', 'An exact nearest-regime search conditions 3,000 moving-block Monte Carlo paths. A cost-aware threshold converts the resulting distribution into Buy, Hold, or Sell decision support.'],
      ].map(([title, text]) => (
        <section key={title} className="surface p-6">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mt-3 text-sm leading-6 text-text-secondary">{text}</p>
        </section>
      ))}
    </div>
  );
}

function FrameworkView() {
  return (
    <section className="surface p-6">
      <h2 className="text-lg font-semibold">Agent trading framework</h2>
      <AxisGroup title="Technical 5D" axes={TECHNICAL_AXES} offset={0} />
      <AxisGroup title="Perception 5D" axes={PERCEPTION_AXES} offset={5} />
      <div className="mt-6 grid gap-4 lg:grid-cols-4">
        {[
          ['1. Observe', 'Completed daily candles create robust return, trend, volatility, drawdown, and volume-regime features.'],
          ['2. Condition', 'Exact KNN selects historical regimes only when their full forward outcome is already known.'],
          ['3. Simulate', 'Weighted three-session blocks generate 3,000 dependent 10-session return paths.'],
          ['4. Decide', 'Costs and a 58% probability threshold gate Buy/Sell; otherwise the policy emits Hold.'],
        ].map(([title, text]) => (
          <div key={title} className="rounded-md border border-border-color bg-bg-secondary p-4">
            <h3 className="font-semibold">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-text-secondary">{text}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-md border border-border-color bg-bg-secondary p-4 text-sm leading-6 text-text-secondary">
        This is a regime-conditioned Monte Carlo policy, not reinforcement learning. RL should only be enabled after a trading environment, reward function, offline training set, purged walk-forward validation, and independent forward-paper evaluation exist. The system does not auto-place orders.
      </div>
    </section>
  );
}

function AxisGroup({ title, axes, offset }) {
  return (
    <div className="mt-6">
      <h3 className="text-sm font-bold uppercase tracking-wider text-text-muted">{title}</h3>
      <div className="mt-3 grid gap-4 md:grid-cols-5">
        {axes.map((axis, index) => (
          <div key={axis} className="rounded-md border border-border-color bg-bg-secondary p-4">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-accent-green text-sm font-black text-bg-primary">{offset + index + 1}</span>
            <h4 className="mt-4 font-semibold">{axis}</h4>
            <p className="mt-2 text-sm leading-6 text-text-secondary">{axisDescription(axis)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function axisDescription(axis) {
  return {
    Price: 'Daily return and candle direction.',
    Volume: 'Participation surge versus recent average.',
    Volatility: 'Current range versus ATR-style baseline.',
    Momentum: 'Distance from recent moving-average context.',
    'Technical Macro': 'Broad market directional pressure as a technical proxy.',
    'Domestic Market': 'Nifty and local market direction affecting Indian equities.',
    Peers: 'Same-sector peer movement to catch sector rotation.',
    'International Market': 'Global index risk-on or risk-off pressure.',
    'News / Events': 'Recent headlines, corporate actions, policy, and market perception.',
    'Time Regime': 'Short-term trend and session timing bias.',
  }[axis];
}

function stateAxisCount(simulation) {
  if (simulation?.state_vector?.length) return simulation.state_vector.length;
  const technical = simulation?.technical_vector?.length || simulation?.vector?.length || 0;
  const perception = simulation?.perception_vector?.length || 0;
  return technical + perception;
}

function formatSigned(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '--';
  const numeric = Number(value);
  return `${numeric >= 0 ? '+' : ''}${numeric.toFixed(2)}`;
}

function getActionTone(action) {
  if (action === 'Buy') return 'positive';
  if (action === 'Sell') return 'negative';
  if (action === 'Hold') return 'amber';
  return 'neutral';
}

function classifyLog(message = '') {
  const text = message.toLowerCase();
  if (text.includes('buy') || text.includes('bullish') || text.includes('positive')) return 'text-accent-green';
  if (text.includes('sell') || text.includes('bearish') || text.includes('negative') || text.includes('error')) return 'text-accent-red';
  if (text.includes('faiss') || text.includes('vector')) return 'text-accent-amber';
  return 'text-text-secondary';
}
