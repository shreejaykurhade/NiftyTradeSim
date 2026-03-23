import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Chart from '../components/Chart';

// Generate professional-looking demo data for the landing chart
const generateDemoData = () => {
  const data = [];
  let price = 2450;
  const now = Math.floor(Date.now() / 1000);
  
  for (let i = 100; i >= 0; i--) {
    const time = now - (i * 86400);
    const open = price + (Math.random() * 20 - 10);
    const high = open + Math.random() * 15;
    const low = open - Math.random() * 15;
    const close = (high + low) / 2 + (Math.random() * 10 - 5);
    
    data.push({ time, open, high, low, close });
    price = close;
  }
  return data;
};

export default function Landing() {
  const { user } = useAuth();
  const demoData = generateDemoData();

  if (user) return <Navigate to="/" />;

  return (
    <div className="bg-bg-primary text-text-primary relative">
      {/* Background Orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-accent-green/5 rounded-full blur-[160px]" />
      <div className="absolute bottom-[-10%] right-[-20%] w-[50%] h-[50%] bg-accent-blue/5 rounded-full blur-[160px]" />

      {/* Navigation Branding */}
      <nav className="container mx-auto px-6 py-6 flex justify-between items-center relative z-20">
        <div className="flex items-center gap-2">
          <span className="text-xl font-black tracking-tighter italic">Nifty50Sim</span>
        </div>
        <div className="flex gap-8 items-center text-sm font-bold">
          <Link to="/login" className="text-text-secondary hover:text-text-primary transition-colors">Sign In</Link>
          <Link to="/register" className="btn-login px-5 py-2 rounded-lg text-xs shadow-lg shadow-accent-green/20">Get Started</Link>
        </div>
      </nav>

      {/* ORIGINAL HERO SECTION - Restored but refined */}
      <div className="container mx-auto px-6 pt-24 pb-20 text-center relative z-10">
        <div className="inline-block px-4 py-1.5 rounded-full bg-accent-green/10 border border-accent-green/20 text-accent-green text-[10px] font-bold uppercase tracking-widest mb-8 animate-fade-in">
          The Future of Indian Trading Simulation
        </div>
        
        <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-6 bg-gradient-to-b from-text-primary to-text-secondary bg-clip-text text-transparent leading-[0.9]">
          Master the Market. <br /> 
          <span className="bg-gradient-to-r from-zinc-500 via-zinc-200 to-zinc-600 bg-clip-text text-transparent">Risk Absolutely Nothing.</span>
        </h1>
        
        <p className="max-w-2xl mx-auto text-text-secondary text-lg md:text-xl mb-12 leading-relaxed font-medium opacity-80">
          Experience NIFTY 50 trading with institutional-grade tools, 
          AI-driven sentiment, and 30+ years of verifiable history.
        </p>

        <div className="flex flex-col sm:flex-row justify-center items-center gap-6">
          <Link 
            to="/register" 
            className="btn-login px-10 py-4 rounded-xl text-lg font-bold shadow-2xl shadow-accent-green/30 hover:scale-105 transition-all w-full sm:w-auto"
          >
            Start Trading Now
          </Link>
          <Link 
            to="/login" 
            className="px-10 py-4 rounded-xl text-lg font-bold border border-border-color hover:bg-bg-secondary w-full sm:w-auto transition-all bg-bg-primary/50 backdrop-blur-sm"
          >
            Sign In to Terminal
          </Link>
        </div>
      </div>

      {/* TERMINAL PREVIEW - Now below the hero */}
      <div className="container mx-auto px-6 py-20 relative z-10">
        <div className="max-w-6xl mx-auto relative group">
          <div className="absolute inset-0 bg-accent-green/10 blur-[100px] opacity-10" />
          
          <div className="card glass !p-0 border-border-color/50 rounded-2xl overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.5)] border-t-accent-green/20">
            {/* Terminal Top Bar */}
            <div className="bg-bg-secondary px-4 py-3 flex items-center justify-between border-b border-border-color">
              <div className="flex items-center gap-6">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-accent-red/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-accent-yellow-400/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-accent-green/60" />
                </div>
                <div className="flex items-center gap-4 text-[11px] font-mono text-text-secondary">
                  <span className="text-accent-green font-bold">NSE:NIFTY_50</span>
                  <span className="opacity-40">ITEM:INFY.NS</span>
                  <span className="text-white">₹1,642.15</span>
                  <span className="text-accent-green">+2.1%</span>
                </div>
              </div>
              <div className="text-[10px] font-mono text-text-secondary bg-bg-primary px-3 py-1 rounded-full border border-border-color">
                <span className="animate-pulse inline-block w-1.5 h-1.5 bg-accent-green rounded-full mr-2" />
                LIVE TERMINAL FEED
              </div>
            </div>

            <div className="grid grid-cols-12 h-[550px]">
              {/* Main Chart Area */}
              <div className="col-span-12 lg:col-span-9 border-r border-border-color p-6 bg-bg-primary/40 relative">
                <div className="absolute top-10 left-10 text-[60px] font-black text-white/5 uppercase tracking-tighter select-none">PRO PREVIEW</div>
                <Chart data={demoData} timeframe="1D" range="6M" />
              </div>

              {/* Side Analysis Panels */}
              <div className="hidden lg:flex flex-col col-span-3 bg-bg-secondary/20 p-5 space-y-8 overflow-hidden backdrop-blur-md">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-text-secondary tracking-[0.2em] uppercase">Market Depth</h4>
                  <div className="space-y-1.5 font-mono text-[10px]">
                    {[...Array(8)].map((_, i) => (
                      <div key={i} className="flex justify-between items-center group cursor-default">
                        <span className="text-accent-red/80 group-hover:text-accent-red">164{i}.{i * 2}</span>
                        <div className="flex-1 border-b border-dashed border-border-color/30 mx-2" />
                        <span className="text-text-secondary">{i * 12 + 40}k</span>
                      </div>
                    ))}
                    <div className="py-4 text-center">
                      <div className="text-xl font-black text-white">1642.15</div>
                      <div className="text-[10px] text-accent-green font-bold uppercase tracking-widest">Bullish Flow</div>
                    </div>
                    {[...Array(8)].map((_, i) => (
                      <div key={i} className="flex justify-between items-center group cursor-default">
                        <span className="text-accent-green/80 group-hover:text-accent-green">164{8-i}.{i * 3}</span>
                        <div className="flex-1 border-b border-dashed border-border-color/30 mx-2" />
                        <span className="text-text-secondary">{i * 15 + 30}k</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-border-color/50">
                  <h4 className="text-[10px] font-black text-text-secondary tracking-[0.2em] uppercase">Diagnostic Engine</h4>
                  <div className="space-y-4">
                    <div className="p-3 bg-bg-primary/50 rounded-xl border border-border-color/50 group hover:border-accent-green/30 transition-all">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[10px] font-bold opacity-60">AI Confidence</span>
                        <span className="text-accent-green font-black text-[12px]">87.2%</span>
                      </div>
                      <div className="h-1 w-full bg-border-color/30 rounded-full overflow-hidden">
                        <div className="h-full bg-accent-green animate-grow-x" style={{ width: '87%' }} />
                      </div>
                    </div>
                    
                    <div className="p-3 bg-bg-primary/50 rounded-xl border border-border-color/50 group hover:border-accent-blue/30 transition-all">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[10px] font-bold opacity-60">RS Index (14)</span>
                        <span className="text-accent-blue font-black text-[12px]">68.4</span>
                      </div>
                      <div className="h-1 w-full bg-border-color/30 rounded-full overflow-hidden">
                        <div className="h-full bg-accent-blue" style={{ width: '68%' }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* INSTITUTIONAL AI SECTION */}
      <div className="container mx-auto px-6 py-32 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
          <div className="space-y-10">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em]">
                Neural Infrastructure
              </div>
              <h2 className="text-5xl md:text-6xl font-black tracking-tighter leading-[0.95] text-white">
                Institutional Grade <br /> 
                <span className="text-indigo-400">AI Reasoning.</span>
              </h2>
              <p className="text-text-secondary text-lg leading-relaxed max-w-xl font-medium">
                Don't just trade on gut feeling. Leverage our **6-Agent Sentiment Pipeline** that cross-references 
                domestic news, sectoral trends, and global macro-economic indicators in real-time.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {[
                { label: "Investigator Agent", desc: "Deep-dives into Tavily's real-time financial news index.", icon: "🔍" },
                { label: "Analyst Agent", desc: "Synthesizes raw data into actionable technical signals.", icon: "📊" },
                { label: "Auditor Agent", desc: "Ensures no hallucinations; strictly verified data citations.", icon: "🛡️" }
              ].map((item, idx) => (
                <div key={idx} className="flex gap-6 p-6 rounded-2xl bg-bg-secondary/30 border border-border-color/50 hover:border-indigo-500/30 transition-all group">
                  <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center text-xl group-hover:scale-110 transition-transform shadow-inner">
                    {item.icon}
                  </div>
                  <div className="space-y-1">
                    <h5 className="font-black text-white text-base tracking-tight">{item.label}</h5>
                    <p className="text-sm text-text-secondary leading-snug">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            {/* Decorative Glow */}
            <div className="absolute -inset-10 bg-indigo-500/10 blur-[120px] opacity-40 rounded-full" />
            
            <div className="card glass !p-1 border-border-color/50 rounded-[2rem] overflow-hidden shadow-2xl relative z-10">
              <div className="bg-bg-primary/80 backdrop-blur-xl p-8 rounded-[1.8rem] space-y-8 border border-white/5">
                <div className="flex justify-between items-center border-b border-white/5 pb-6">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-indigo-400 tracking-[0.3em] uppercase">Intelligence Hub</span>
                    <h3 className="text-xl font-bold text-white tracking-tight">Proprietary Grader</h3>
                  </div>
                  <div className="px-3 py-1 rounded-md bg-white/5 border border-white/10 font-mono text-[10px] text-text-secondary">
                    VER: 0.8.4
                  </div>
                </div>

                <div className="space-y-10">
                  <div className="flex justify-between items-center">
                    <div className="space-y-1">
                      <p className="text-[10px] text-text-secondary uppercase font-bold tracking-widest">Recommendation</p>
                      <p className="text-4xl font-black text-accent-green italic tracking-tighter">STRONG BUY</p>
                    </div>
                    <div className="text-right space-y-1">
                      <p className="text-[10px] text-text-secondary uppercase font-bold tracking-widest">Signal Strength</p>
                      <p className="text-4xl font-black text-white tabular-nums">92%</p>
                    </div>
                  </div>

                  <div className="relative p-6 bg-accent-green/5 rounded-2xl border border-accent-green/20">
                    <div className="absolute -top-3 left-6 px-2 bg-bg-primary text-[9px] font-black text-accent-green uppercase tracking-widest">
                      Live Analysis
                    </div>
                    <p className="text-sm text-text-primary leading-relaxed font-medium italic">
                      "Cluster analysis of global tech indices shows a +3.4% correlation with NIFTY IT outlook over the next 48 hours."
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-1 text-center">
                      <p className="text-[9px] text-text-secondary uppercase font-bold">Accuracy</p>
                      <p className="text-lg font-bold text-white">99.2%</p>
                    </div>
                    <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-1 text-center">
                      <p className="text-[9px] text-text-secondary uppercase font-bold">Latency</p>
                      <p className="text-lg font-bold text-white">&lt; 150ms</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FEATURE GRID Section */}
        <div className="mt-40 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { title: "5s WebSockets", desc: "Real-time liquidity polling.", icon: "⚡", accent: "green" },
            { title: "30Y History", desc: "Backtest every cycle since 1990.", icon: "⏳", accent: "blue" },
            { title: "Smart Portfolios", desc: "Live P/L tracking with precision.", icon: "⚖️", accent: "indigo" },
            { title: "Verified Links", desc: "Direct access to corporate hubs.", icon: "🔗", accent: "red" }
          ].map((f, i) => (
            <div key={i} className="card glass p-8 hover:bg-white/5 transition-all group border-border-color/30">
              <div className={`w-12 h-12 rounded-2xl bg-bg-secondary flex items-center justify-center text-2xl border border-border-color mb-6 group-hover:scale-110 group-hover:border-accent-${f.accent}/40 transition-all`}>
                {f.icon}
              </div>
              <h3 className="font-black text-lg text-white mb-2 tracking-tight">{f.title}</h3>
              <p className="text-sm text-text-secondary leading-relaxed font-medium">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* FOOTER */}
      <footer className="container mx-auto px-6 pt-24 pb-12 relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-center gap-12 border-t border-white/5 pt-12">
          <div className="space-y-4 text-center md:text-left">
            <div className="text-xl font-black italic tracking-tighter text-white">Nifty50Sim</div>
            <p className="text-[10px] text-text-secondary font-black tracking-[0.4em] uppercase opacity-60">Financial Intelligence Infrastructure</p>
          </div>
          
          <div className="flex gap-12 text-[10px] font-black tracking-widest text-text-secondary uppercase">
            <a href="#" className="hover:text-white transition-colors">Documentation</a>
            <a href="#" className="hover:text-white transition-colors">API Status</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
          </div>
        </div>

        <div className="mt-20 text-center space-y-2">
          <p className="text-[10px] text-text-secondary opacity-40 font-medium">
            Powered by Gemini 1.5 Pro & Tavily Deep Search • Non-Commercial Trading Simulator
          </p>
          <div className="flex justify-center items-center gap-4 text-[9px] text-text-secondary opacity-30 font-mono">
            <span>© 2026 NIFTY50SIM INC.</span>
            <span className="w-1 h-1 rounded-full bg-border-color" />
            <span>METADATA_VERSION: 2.1.0</span>
            <span className="w-1 h-1 rounded-full bg-border-color" />
            <span>REGION: NSE-INDIA</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
