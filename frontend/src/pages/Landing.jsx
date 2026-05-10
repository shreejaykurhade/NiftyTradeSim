import { Link, Navigate } from 'react-router-dom';
import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Chart from '../components/Chart';

function generateDemoData() {
  const data = [];
  let price = 22480;
  const now = Math.floor(Date.now() / 1000);

  for (let i = 160; i >= 0; i -= 1) {
    const trend = Math.sin(i / 11) * 42;
    const open = price + trend + Math.random() * 28 - 14;
    const close = open + Math.random() * 64 - 24;
    const high = Math.max(open, close) + Math.random() * 45;
    const low = Math.min(open, close) - Math.random() * 45;
    data.push({ time: now - i * 86400, open, high, low, close });
    price = close;
  }

  return data;
}

export default function Landing() {
  const { user } = useAuth();
  const demoData = useMemo(() => generateDemoData(), []);

  if (user) return <Navigate to="/" />;

  return (
    <div className="min-h-screen text-text-primary">
      <nav className="container-page flex h-20 items-center justify-between">
        <Link to="/landing" className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-accent-green text-sm font-black text-bg-primary">N50</span>
          <span>
            <span className="block text-base font-black">Nifty50Sim</span>
            <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">Trading Lab</span>
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <Link to="/login" className="btn-ghost px-4 py-2 text-sm">Sign in</Link>
          <Link to="/register" className="btn-primary px-4 py-2 text-sm">Get started</Link>
        </div>
      </nav>

      <section className="container-page grid min-h-[calc(100vh-5rem)] items-center gap-10 pb-12 pt-8 lg:grid-cols-[0.92fr_1.08fr]">
        <div>
          <div className="status-pill w-fit bg-accent-green/10 text-accent-green">
            <span className="h-2 w-2 rounded-full bg-accent-green" />
            NIFTY 50 paper trading platform
          </div>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight md:text-6xl">
            Practice Indian equity trading with a real platform feel.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-text-secondary md:text-lg">
            A focused simulator for market scanning, live watchlists, stock charts, portfolio P&L, order execution, and AI-assisted analysis.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/register" className="btn-primary px-6 py-3">Open trading workspace</Link>
            <Link to="/login" className="btn-ghost px-6 py-3">Sign in</Link>
          </div>

          <div className="mt-10 grid max-w-xl grid-cols-3 gap-3">
            <MiniStat label="Universe" value="50" />
            <MiniStat label="Mode" value="Paper" />
            <MiniStat label="Signals" value="AI + RL" />
          </div>
        </div>

        <div className="surface overflow-hidden">
          <div className="flex items-center justify-between border-b border-border-color p-4">
            <div>
              <p className="label">Terminal preview</p>
              <h2 className="mt-1 font-semibold">NIFTY 50 / Live Workspace</h2>
            </div>
            <div className="text-right">
              <p className="text-xl font-semibold tabular-nums text-accent-green">₹22,684.40</p>
              <p className="text-xs font-bold text-accent-green">+0.74%</p>
            </div>
          </div>

          <div className="grid lg:grid-cols-[1fr_240px]">
            <div className="min-h-[430px] p-4">
              <Chart data={demoData} timeframe="1D" range="6M" height={430} symbol="NIFTY 50" />
            </div>
            <div className="border-t border-border-color bg-bg-secondary/70 p-4 lg:border-l lg:border-t-0">
              <p className="label">Market movers</p>
              <div className="mt-4 space-y-3">
                {[
                  ['RELIANCE', '+1.82%', '₹2,941.25', 'green'],
                  ['HDFCBANK', '+0.96%', '₹1,684.10', 'green'],
                  ['INFY', '-0.44%', '₹1,462.30', 'red'],
                  ['TCS', '+0.31%', '₹3,998.75', 'green'],
                ].map(([symbol, change, price, color]) => (
                  <div key={symbol} className="rounded-md border border-border-color bg-bg-primary p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{symbol}</span>
                      <span className={`text-xs font-bold ${color === 'green' ? 'text-accent-green' : 'text-accent-red'}`}>{change}</span>
                    </div>
                    <p className="mt-1 text-sm tabular-nums text-text-secondary">{price}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container-page grid gap-4 pb-20 md:grid-cols-3">
        <Feature title="Professional market dashboard" text="Search, sort, and compare all NIFTY 50 instruments from one fast workspace." />
        <Feature title="Paper order execution" text="Place simulated buy/sell orders and track cash, holdings, average price, and P&L." />
        <Feature title="AI assisted research" text="Use sentiment and agent simulations as a decision-support layer, not a toy widget." />
      </section>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="surface-flat p-4">
      <p className="label">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}

function Feature({ title, text }) {
  return (
    <article className="surface p-6">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-text-secondary">{text}</p>
    </article>
  );
}
