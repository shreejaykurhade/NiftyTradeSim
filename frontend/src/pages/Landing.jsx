import { Link, Navigate } from 'react-router-dom';
import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import nifty50Logo from '../assets/nifty50-logo.svg';

function generateDemoData() {
  let seed = 71623;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  const tradingDays = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  while (tradingDays.length < 92) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) tradingDays.unshift(Math.floor(cursor.getTime() / 1000));
    cursor.setDate(cursor.getDate() - 1);
  }

  let previousClose = 21920;

  return tradingDays.map((time, index) => {
    const regime = index < 25 ? -0.0014 : index < 55 ? 0.0018 : 0.0007;
    const volatility = index > 58 && index < 72 ? 0.012 : 0.007;
    const open = previousClose + (random() - 0.5) * previousClose * 0.004;
    const shock = random() > 0.92 ? (random() - 0.5) * previousClose * 0.024 : 0;
    const close = open + previousClose * (regime + (random() - 0.5) * volatility) + shock;
    const wick = previousClose * (0.003 + random() * 0.006);
    const high = Math.max(open, close) + wick * (0.7 + random());
    const low = Math.min(open, close) - wick * (0.5 + random());
    const volume = Math.round(130000 + random() * 90000 + Math.abs(close - open) * 760);

    previousClose = close;

    return {
      time,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume,
    };
  });
}

const movers = [
  ['RELIANCE', '+1.82%', '2,941.25', 'green'],
  ['HDFCBANK', '+0.96%', '1,684.10', 'green'],
  ['INFY', '-0.44%', '1,462.30', 'red'],
  ['TCS', '+0.31%', '3,998.75', 'green'],
];

const capabilities = [
  ['Market watch', 'Track NIFTY 50 names with price, change, volume, and session context.'],
  ['Paper execution', 'Practice entries and exits with cash, exposure, holdings, and simulated fills.'],
  ['Strategy lab', 'Backtest rules and compare trend, momentum, mean reversion, and passive ideas.'],
  ['Research notes', 'Use AI and sentiment as structured context beside the chart, not as a black box.'],
];

const workflow = [
  ['Prepare', 'Scan the index, check leaders and laggards, and decide what deserves attention.'],
  ['Execute', 'Place paper orders with position size, exposure, and cash impact visible.'],
  ['Review', 'Compare the thesis against price action, P&L, and research notes after the move.'],
];

const principles = [
  ['Risk first', 'Exposure and cash stay visible so every idea has a cost.'],
  ['Rules over impulse', 'Strategy tests help separate repeatable behavior from one-off trades.'],
  ['Learn by replaying', 'The simulator turns market sessions into a reviewable practice loop.'],
];

export default function Landing() {
  const { user } = useAuth();
  const demoData = useMemo(() => generateDemoData(), []);

  if (user) return <Navigate to="/" />;

  return (
    <div className="landing-shell min-h-screen text-text-primary">
      <nav className="container-page flex h-20 items-center justify-between">
        <Link to="/landing" className="flex items-center gap-3">
          <img src={nifty50Logo} alt="Nifty50Sim" className="brand-mark" />
          <span>
            <span className="block text-base font-bold">Nifty50Sim</span>
          </span>
        </Link>

        <div className="hidden items-center gap-8 text-sm font-medium text-text-secondary md:flex">
          <a href="#platform" className="transition hover:text-text-primary">Platform</a>
          <a href="#capabilities" className="transition hover:text-text-primary">Capabilities</a>
          <a href="#workflow" className="transition hover:text-text-primary">Workflow</a>
          <a href="#discipline" className="transition hover:text-text-primary">Discipline</a>
        </div>

        <div className="flex items-center gap-3">
          <Link to="/login" className="btn-ghost px-4 py-2 text-sm">Sign in</Link>
          <Link to="/register" className="btn-primary px-4 py-2 text-sm">Launch workspace</Link>
        </div>
      </nav>

      <section className="container-page landing-hero">
        <div className="max-w-2xl">
          <h1>Train your trading process before you risk capital.</h1>
          <p>
            A focused Indian equity simulator for reading charts, testing ideas, placing paper orders, and reviewing decisions with real desk discipline.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link to="/register" className="btn-primary px-6 py-3 text-base">Start paper trading</Link>
            <Link to="/login" className="btn-ghost px-6 py-3 text-base">Open existing account</Link>
          </div>

          <div className="hero-facts">
            <HeroStat label="Universe" value="50" />
            <HeroStat label="Paper cash" value="₹10L" />
            <HeroStat label="Mode" value="Paper" tone="text-accent-blue" />
          </div>
        </div>

        <div id="platform" className="market-preview">
          <div className="market-preview-header">
            <div>
              <p className="label">Market preview</p>
              <h2>NIFTY 50 daily chart</h2>
            </div>
            <div className="text-right">
              <p>₹22,684.40</p>
              <span>+0.74% today</span>
            </div>
          </div>

          <LandingMarketChart data={demoData} />

          <div className="market-summary">
            <ActionTile label="Cash balance" value="₹8.42L" />
            <ActionTile label="Exposure" value="62%" tone="text-accent-amber" />
            <div className="landing-note">
              <span className="label">Desk note</span>
              <p>Breadth is improving, but resistance is close. Wait for confirmation before adding size.</p>
            </div>
            <div className="market-row">
              {movers.map(([symbol, change, price, color]) => (
                <div key={symbol}>
                  <span>{symbol}</span>
                  <strong>₹{price}</strong>
                  <em className={color === 'green' ? 'text-accent-green' : 'text-accent-red'}>{change}</em>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="capabilities" className="container-page landing-section">
        <div className="section-header">
          <p className="label text-accent-blue">Core workspace</p>
          <h2>One place to scan, trade, test, and review.</h2>
          <p>
            The landing page should show what the app actually does. These are the main surfaces users work with once they enter the simulator.
          </p>
        </div>

        <div className="capability-grid compact">
          {capabilities.map(([title, text]) => (
            <article key={title} className="capability-card">
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="workflow" className="container-page landing-section">
        <div className="split-section">
          <div>
            <p className="label text-accent-green">Trading loop</p>
            <h2>Built around the routine, not the hype.</h2>
            <p>
              The simulator follows the way traders actually improve: prepare a view, execute with constraints, then review what happened.
            </p>
          </div>

          <div className="workflow-list">
            {workflow.map(([title, text], index) => (
              <article key={title}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="discipline" className="container-page landing-section">
        <div className="discipline-panel">
          <div>
            <p className="label text-accent-blue">Practice discipline</p>
            <h2>Make every simulated trade explainable.</h2>
            <p>
              A good simulator should slow the user down in the right places: before sizing risk, after taking a signal, and during review.
            </p>
          </div>
          <div className="principle-list">
            {principles.map(([title, text]) => (
              <article key={title}>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page pb-20">
        <div className="cta-band">
          <div>
            <p className="label text-accent-green">Ready when the market opens</p>
            <h2>Build the habit before you put capital behind it.</h2>
            <p>
              Rehearse ideas, understand risk, and create a repeatable decision process around Indian equities.
            </p>
          </div>
          <Link to="/register" className="btn-primary px-6 py-3 text-base">Create workspace</Link>
        </div>
      </section>
    </div>
  );
}

function LandingMarketChart({ data }) {
  const width = 920;
  const height = 430;
  const pad = { top: 28, right: 72, bottom: 72, left: 18 };
  const chartHeight = height - pad.top - pad.bottom;
  const chartWidth = width - pad.left - pad.right;
  const prices = data.flatMap((candle) => [candle.high, candle.low]);
  const maxPrice = Math.max(...prices);
  const minPrice = Math.min(...prices);
  const pricePadding = (maxPrice - minPrice) * 0.08;
  const highBound = maxPrice + pricePadding;
  const lowBound = minPrice - pricePadding;
  const maxVolume = Math.max(...data.map((candle) => candle.volume));
  const candleGap = chartWidth / data.length;
  const candleWidth = Math.max(4, candleGap * 0.56);
  const y = (price) => pad.top + ((highBound - price) / (highBound - lowBound)) * chartHeight;
  const x = (index) => pad.left + index * candleGap + candleGap / 2;
  const volumeTop = height - 54;
  const ma = data.map((_, index) => {
    const start = Math.max(0, index - 11);
    const slice = data.slice(start, index + 1);
    return slice.reduce((sum, candle) => sum + candle.close, 0) / slice.length;
  });
  const maPath = ma.map((value, index) => `${index === 0 ? 'M' : 'L'} ${x(index).toFixed(2)} ${y(value).toFixed(2)}`).join(' ');
  const priceLevels = [highBound, (highBound + lowBound) / 2, lowBound];

  return (
    <div className="landing-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="NIFTY 50 candlestick preview">
        <rect width={width} height={height} fill="transparent" />
        {priceLevels.map((level) => (
          <g key={level}>
            <line x1={pad.left} x2={width - pad.right + 18} y1={y(level)} y2={y(level)} className="chart-grid-line" />
            <text x={width - pad.right + 28} y={y(level) + 4} className="chart-axis-text">
              {Math.round(level).toLocaleString('en-IN')}
            </text>
          </g>
        ))}
        {data.filter((_, index) => index % 14 === 0).map((candle, index) => (
          <line key={candle.time} x1={x(index * 14)} x2={x(index * 14)} y1={pad.top} y2={height - 52} className="chart-grid-line vertical" />
        ))}
        {data.map((candle, index) => {
          const isUp = candle.close >= candle.open;
          const bodyTop = y(Math.max(candle.open, candle.close));
          const bodyHeight = Math.max(2, Math.abs(y(candle.open) - y(candle.close)));
          const volumeHeight = (candle.volume / maxVolume) * 44;
          return (
            <g key={candle.time}>
              <rect
                x={x(index) - candleWidth / 2}
                y={volumeTop + (44 - volumeHeight)}
                width={candleWidth}
                height={volumeHeight}
                className={isUp ? 'volume-up' : 'volume-down'}
              />
              <line x1={x(index)} x2={x(index)} y1={y(candle.high)} y2={y(candle.low)} className={isUp ? 'candle-up-stroke' : 'candle-down-stroke'} />
              <rect
                x={x(index) - candleWidth / 2}
                y={bodyTop}
                width={candleWidth}
                height={bodyHeight}
                rx="1.5"
                className={isUp ? 'candle-up' : 'candle-down'}
              />
            </g>
          );
        })}
        <path d={maPath} className="chart-ma-line" />
        <text x={pad.left} y={height - 20} className="chart-axis-text">Volume</text>
        <text x={width - 205} y={height - 20} className="chart-axis-text">12-session average</text>
      </svg>
    </div>
  );
}

function HeroStat({ label, value, tone = 'text-text-primary' }) {
  return (
    <div>
      <p className="text-xs font-bold text-text-muted">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

function ActionTile({ label, value, tone = 'text-text-primary' }) {
  return (
    <div className="landing-metric">
      <p className="text-xs font-bold text-text-muted">{label}</p>
      <p className={`mt-2 text-xl font-semibold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}
