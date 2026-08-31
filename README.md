# Context-Aware Agentic Advisor: Intelligent Trading Simulation for Nifty 50

> A paper-trading research platform that combines quantitative market data, bounded context signals, reproducible Monte Carlo risk estimates, and explicit validation gates.

[![Status](https://img.shields.io/badge/Status-Research%20Prototype-orange)](https://github.com)
[![Node.js](https://img.shields.io/badge/Node.js-%5E18.0.0-green)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19.0.0-blue)](https://react.dev/)
[![MongoDB](https://img.shields.io/badge/MongoDB-9.3.1-green)](https://www.mongodb.com/)
[![License](https://img.shields.io/badge/License-ISC-blue)](LICENSE)

---

> **Model status:** This repository is a paper-trading research prototype, not an institutional-grade or real-money system. Legacy sections below describe the original design proposal and may include targets that have not been independently validated. The live Agent Trading route now uses a leakage-aware, regime-conditioned moving-block Monte Carlo policy and explicitly does **not** claim reinforcement learning. See [`trading_framework/simulation/README.md`](trading_framework/simulation/README.md) for the implemented design and remaining validation gates.

## Table of Contents

- [Overview](#overview)
- [Problem Statement](#problem-statement)
- [Solution](#solution)
- [Key Features](#key-features)
- [System Architecture](#system-architecture)
- [Quantitative Decision and RL Research Architecture](#quantitative-decision-and-rl-research-architecture)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Installation & Setup](#installation--setup)
- [Usage](#usage)
- [Legacy 6-Agent Design Proposal](#the-6-agent-ai-swarm)
- [5-Dimensional State Space Model](#5-dimensional-state-space-model)
- [Configuration](#configuration)
- [Documentation](#documentation)
- [Performance Metrics](#performance-metrics)
- [Lessons Learned](#lessons-learned)
- [Future Roadmap](#future-roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

**Context-Aware Agentic Advisor** is a research-stage paper-trading platform for the **Nifty 50 universe**. It combines market data, context features, portfolio simulation, deterministic strategy backtests, and a leakage-aware conditional Monte Carlo model. It is designed for experimentation and education, not real-money execution.

The system operates within a rigorously controlled **simulation environment** for educational and backtesting purposes, ensuring no actual financial capital is at risk. Users can simulate trading strategies, receive hyper-personalized execution advice, and backtest trading algorithms against historical market data.

### Quick Stats

- **Core Language:** Node.js + React
- **Market Focus:** Nifty 50 Index
- **Live decision model:** Regime-conditioned moving-block Monte Carlo
- **Explanatory state:** Technical 5D + perception 5D
- **Historical risk state:** 8 leakage-safe dimensions
- **Simulation:** 3,000 seeded paths over 10 sessions
- **Historical window:** Five years when available from the prototype data source
- **Policy status:** `RESEARCH_ONLY`; validation gate not passed

---

## Problem Statement

Traditional retail trading platforms operate in fragmented silos:

- **Data Fragmentation:** Quantitative OHLC data separated from qualitative news and macro-economic context
- **Manual Gap Bridging:** Retail investors forced to manually correlate disparate data sources
- **Contextual Reasoning Gap:** Systems fail to distinguish isolated stock events from systemic sectoral shifts
- **Passive Advisory:** Existing AI systems act as passive summarizers, not autonomous decision-makers
- **Lack of Personalization:** Generic recommendations without consideration of individual risk profiles or capital constraints

This fragmentation leaves retail investors at a significant disadvantage when making trading decisions.

---

## Solution

We propose an **intelligent, multi-agent trading simulation environment** that:

1. **Unifies Research Surfaces:** Connects market data, paper execution, portfolio state, strategy testing, and agent context.
2. **Separates Explanation from Policy:** Context signals are bounded and cannot silently become unrestricted trading actions.
3. **Reports Distributions:** Monte Carlo output includes median return, cost-clearing probability, VaR, expected shortfall, and drawdown.
4. **Fails Closed:** Missing data, insufficient history, non-finite state, or an unvalidated policy produces an explicit research/error status.
5. **Enables Reproducible Study:** Seeded simulation, chronological evaluation, and versioned model diagnostics support paper-trading research.

---

## Key Features

### ✨ Core Features

- **Real-Time Market Data Pipeline**
  - 10-second polling intervals from Yahoo Finance
  - Redis in-memory caching for <10s average latency
  - WebSocket broadcasting to concurrent clients

- **Context + Risk Pipeline**
  - Technical and perception feature stages
  - Exact robust-scaled nearest-regime retrieval
  - Weighted moving-block Monte Carlo simulation
  - Cost-aware Buy/Hold/Sell decision rule
  - Explicit research-only and non-RL diagnostics

- **5-Dimensional State Space Model**
  - Price Action (P): Normalized daily returns
  - Volume/Liquidity (V): Volume surge analysis
  - Volatility (Vol): ATR normalization
  - Momentum (M): SMA trajectory analysis
  - Macro/Benchmark (Mac): Market sentiment tracking

- **Simulated Trade Execution**
  - Market and Limit order support
  - Real-time Order Matching Engine
  - Atomic portfolio settlement
  - Real-time P&L calculation

- **Hyper-Personalized Advisory**
  - Risk profile customization
  - Capital constraint consideration
  - Confidence-weighted recommendations

- **Historical Backtesting**
  - Exact FAISS KNN regime conditioning
  - 3,000-path moving-block Monte Carlo distribution
  - Cost-aware Buy/Hold/Sell threshold with explicit risk diagnostics

### 🔐 Security & Reliability

- JWT-based authentication
- Bcrypt password hashing
- Rate-limiting middleware
- Comprehensive error handling
- Transactional database consistency

---

## System Architecture

### 4-Layer Architecture

```
┌─────────────────────────────────────────────────────┐
│  Layer 1: Frontend (React 19 SPA)                   │
│  - Real-time 5D visualization                       │
│  - Interactive dashboards                           │
│  - Live price ticker                                │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│  Layer 2: Real-Time Pipeline (Node.js)              │
│  - Socket.io WebSocket broadcasting                 │
│  - Redis pub/sub and caching                        │
│  - High-frequency polling (10s intervals)           │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│  Layer 3: Context + Quant Research Engine           │
│  - Technical 5D and perception 5D features          │
│  - 8D historical regime state                       │
│  - KNN-conditioned moving-block Monte Carlo         │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│  Layer 4: Data Persistence                          │
│  - MongoDB (user, orders, holdings, candles)        │
│  - Exact in-memory FAISS regime search              │
│  - Redis cache (real-time prices)                   │
└─────────────────────────────────────────────────────┘
```

---

## Quantitative Decision and RL Research Architecture

### Implemented model

The live system is a **conditional historical Monte Carlo model**, not RL. For completed adjusted closes $P_t$, one-session log return is

$$
r_t=\log(P_t/P_{t-1}).
$$

It constructs an 8D point-in-time state

$$
x_t=[r_{1,t},r_{5,t},m_{20,t},q_{20/60,t},\sigma_{20,t},\nu_t,d_{60,t},v_t],
$$

covering short returns, momentum, trend, volatility, volatility regime, drawdown, and volume shock. Candidate states are robust-scaled with median and interquartile range. Only dates with a completely observed forward 10-session path are eligible, preventing future-label leakage.

For squared exact-neighbor distance $d_i$, sampling weights are

$$
w_i=\frac{\exp(-d_i/\tau)}{\sum_j\exp(-d_j/\tau)},
\qquad
\tau=\operatorname{Median}\{d_i:d_i>0\}.
$$

Three-session blocks from the 80 nearest completed regimes generate 3,000 seeded paths. Terminal path return is

$$
R_T^{(m)}=\exp\left(\sum_{h=1}^{10}\widehat r_h^{(m)}\right)-1.
$$

With estimated cost $\kappa=15$ bps and probability gate $\theta=0.58$:

$$
\pi(x_T)=
\begin{cases}
\text{Buy}, & \Pr(R_T>\kappa)\geq\theta \text{ and median}(R_T)>\kappa,\\
\text{Sell}, & \Pr(R_T<-\kappa)\geq\theta \text{ and median}(R_T)<-\kappa,\\
\text{Hold}, & \text{otherwise}.
\end{cases}
$$

The response includes 95% historical VaR,

$$
\operatorname{VaR}_{0.95}=F_R^{-1}(0.05),
$$

and expected shortfall,

$$
\operatorname{ES}_{0.95}=\mathbb E[R\mid R\leq\operatorname{VaR}_{0.95}].
$$

### Proposed RL architecture

A real RL system requires a position-aware Markov decision process, logged behavior propensities, net execution rewards, policy learning, and off-policy evaluation. The proposed long-only action is target position $a_t=w_t^*\in\{0,1\}$; Buy/Sell/Hold is derived from the previous and target positions.

The discounted episodic return is

$$
G_t=\sum_{k=0}^{T-t-1}\gamma^k r_{t+k+1},
$$

and Monte Carlo RL would estimate

$$
Q_\pi(s,a)=\mathbb E_\pi[G_t\mid S_t=s,A_t=a]
$$

from complete episodes before improving the policy. Because the repository does not yet have a qualified offline episode dataset or a validated policy artifact, RL is deliberately disabled. The recommended research direction is conservative offline RL with doubly robust off-policy evaluation, purged walk-forward validation, an untouched holdout, and long shadow deployment.

The full faculty-style derivation—including every feature equation, bootstrap estimator, confidence shrinkage, MDP state/action/reward contract, Conservative Q-Learning objective, doubly robust OPE formula, validation protocol, and governance gates—is in [`trading_framework/simulation/README.md`](trading_framework/simulation/README.md).

---

## Technology Stack

### Frontend
```
React 19.0.0         - Modern UI framework
Vite 6.0.0           - Fast build tool
React Router 7.1.0   - Routing
Axios 1.7.0          - HTTP client
Socket.io-client 4.8.0 - Real-time communication
Lightweight Charts 5.1.0 - Financial charting
Tailwind CSS 4.0.0   - Styling
```

### Backend
```
Node.js 18+          - Runtime
Express 5.2.1        - API framework
Socket.io 4.8.3      - WebSocket communication
MongoDB 9.3.1        - Database
Mongoose 9.3.1       - ODM
Redis 5.11.0         - Caching
ioredis 5.10.1       - Redis client
```

### AI & External APIs
```
@google/generative-ai 0.24.1 - Gemini AI
@tavily/core 0.7.2           - News search
yahoo-finance2 3.13.2        - Market data
```

### Additional Libraries
```
jsonwebtoken 9.0.3   - Authentication
bcryptjs 3.0.3       - Password hashing
express-rate-limit 8.3.1 - Rate limiting
node-cron 4.2.1      - Background jobs
helmet 8.1.0         - Security headers
morgan 1.10.1        - Logging
cors 2.8.6           - Cross-origin support
uuid 13.0.0          - ID generation
```

---

## Project Structure

```
NiftyTradeSim-main/
│
├── frontend/                    # React SPA
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   │   ├── Chart.jsx       # 5D visualization
│   │   │   └── Navbar.jsx      # Navigation
│   │   ├── pages/              # Page components
│   │   │   ├── Dashboard.jsx   # Main dashboard
│   │   │   ├── StockDetail.jsx # Stock analysis
│   │   │   ├── Portfolio.jsx   # User portfolio
│   │   │   ├── Login.jsx       # Authentication
│   │   │   └── Register.jsx    # User registration
│   │   ├── contexts/           # React contexts
│   │   │   └── AuthContext.jsx # Auth state
│   │   ├── hooks/              # Custom hooks
│   │   │   └── useSocket.js    # WebSocket hook
│   │   ├── services/           # API services
│   │   │   └── api.js          # Axios setup
│   │   ├── App.jsx             # Root component
│   │   └── main.jsx            # Entry point
│   ├── package.json
│   ├── vite.config.js
│   └── index.html
│
├── backend/                     # Node.js Express API
│   ├── src/
│   │   ├── config/             # Configuration
│   │   │   ├── db.js           # MongoDB connection
│   │   │   ├── redis.js        # Redis connection
│   │   │   └── stocks.js       # Stock symbols
│   │   ├── controllers/        # Route handlers
│   │   │   ├── authController.js
│   │   │   ├── marketController.js
│   │   │   ├── orderController.js
│   │   │   ├── portfolioController.js
│   │   │   ├── candleController.js
│   │   │   └── agentController.js
│   │   ├── models/             # Database schemas
│   │   │   ├── User.js
│   │   │   ├── Order.js
│   │   │   ├── Holding.js
│   │   │   └── StockCandle.js
│   │   ├── routes/             # API routes
│   │   │   ├── auth.js
│   │   │   ├── market.js
│   │   │   ├── orders.js
│   │   │   ├── portfolio.js
│   │   │   ├── candles.js
│   │   │   ├── agents.js
│   │   │   └── sentiment.js
│   │   ├── services/           # Business logic
│   │   │   ├── marketFetcher.js      # Yahoo Finance polling
│   │   │   ├── autoFetcher.js        # Cron job orchestration
│   │   │   ├── sentimentService.js   # 6-Agent swarm logic
│   │   │   └── historicalSeeder.js   # Data initialization
│   │   ├── middleware/         # Express middleware
│   │   │   ├── auth.js         # JWT verification
│   │   │   └── rateLimiter.js  # Rate limiting
│   │   ├── websockets/         # WebSocket handlers
│   │   │   └── socket.js       # Socket.io setup
│   │   └── server.js           # Express app setup
│   ├── scripts/
│   │   ├── seed.js             # Database seeding
│   │   ├── fetch_data.py       # Historical data fetch
│   │   ├── backtest.py         # Backtesting engine
│   │   ├── monte_carlo_rl.py   # RL decision logic
│   │   ├── faiss_store.py      # FAISS indexing
│   │   ├── event_agents.py     # Agent orchestration
│   │   ├── run_agents.py       # Agent execution
│   │   ├── check_live_price.js # Price validation
│   │   ├── audit_data.js       # Data quality checks
│   │   └── test_*.js           # API testing
│   ├── package.json
│   └── .env.example            # Environment template
│
├── Documentation/
│   ├── requirement_analysis_report.md  # Complete SRS
│   ├── presentation_final_slides.md    # Presentation
│   ├── state_diagram.md                # UML state machine
│   └── use_case_diagram.md             # Use cases
│
└── README.md                   # This file
```

---

## Installation & Setup

### Prerequisites

- **Node.js:** v18.0.0 or higher
- **MongoDB:** Local instance or MongoDB Atlas connection
- **Redis:** Local instance (optional, for production)
- **Python:** 3.12 (tested runtime for simulation and backtesting)
- **API Keys:**
  - Google Gemini API key
  - Tavily Search API key

### Step 1: Clone Repository

```bash
git clone https://github.com/shreejaykurhade/ly_proj_trading.git
cd ly_proj_trading
```

### Step 2: Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

**Frontend will run on:** `http://localhost:5173`

### Step 3: Backend Setup

```bash
cd ../backend
npm install
python -m pip install -r requirements-dev.txt
```

### Step 4: Environment Configuration

Create `.env` file in backend directory:

```env
# Server
PORT=5000
NODE_ENV=development

# Database
MONGO_URI=mongodb://localhost:27017/niftytrade
REDIS_HOST=localhost
REDIS_PORT=6379

# Optional when the required packages are installed in a non-default interpreter
PYTHON_BIN=C:\path\to\python.exe

# External APIs
GOOGLE_API_KEY=your_gemini_api_key
TAVILY_API_KEY=your_tavily_api_key

# JWT
JWT_SECRET=your_jwt_secret_key_here_make_it_long_and_random

```

### Step 5: Database Setup

```bash
# Seed initial data
npm run seed
```

### Step 6: Start Backend

```bash
npm run dev      # Development mode with auto-reload
# OR
npm start        # Production mode
```

**Backend API will run on:** `http://localhost:5000`

### Step 7: Verify Setup

Open your browser and navigate to:
- **Frontend:** `http://localhost:5173`
- **API:** `http://localhost:5000/api/health`

---

## Usage

### User Registration & Login

1. Navigate to **Register** page
2. Create account with email and password
3. Login with credentials
4. Receive JWT token for authenticated requests

### Exploring Live Market Data

1. Go to **Dashboard**
2. View live Nifty 50 prices updating every 10 seconds
3. Click on individual stocks for detailed analysis

### Running Agent Trading Research

1. Navigate to **Agent Trading** and select a supported instrument.
2. Click **Run agent simulation**.
3. The streamed pipeline will:
   - calculate technical and perception context;
   - build the leakage-safe historical regime state;
   - retrieve exact comparable regimes;
   - simulate 3,000 10-session paths;
   - report decision strength, VaR, expected shortfall, drawdown, and scenarios;
   - retain `RESEARCH_ONLY` status until validation gates pass.

### Executing Simulated Trades

1. Navigate to **Stock Detail** page
2. Choose **Market Order** or **Limit Order**
3. Enter quantity and price (if limit order)
4. Click **Execute**
5. Order enters **Order Matching Engine**
6. Upon execution, portfolio updates automatically

### Viewing Portfolio & P&L

1. Go to **Portfolio** page
2. View current holdings and average cost
3. Monitor real-time P&L
4. Analyze trading history

### Backtesting Strategies

Use the Python backtesting engine:

```bash
# Generate historical state vectors
python scripts/fetch_data.py --symbol RELIANCE.NS --years 10

# Run the live regime-conditioned Monte Carlo agent pipeline
python backend/scripts/run_agents.py RELIANCE.NS '{}'

# Run deterministic simulation tests
python -m pytest trading_framework/tests/test_conditional_monte_carlo.py -q
```

---

## The 6-Agent AI Swarm

> **Legacy proposal:** This section records the original conceptual agent design. It is not the mathematical contract of the live trading policy. The implemented model is documented in [Quantitative Decision and RL Research Architecture](#quantitative-decision-and-rl-research-architecture).

The system's intelligence core consists of 6 specialized agents that work sequentially:

### 1. **Search Orchestrator Agent**
- **Responsibility:** Converts user ticker into optimized multi-tiered search queries
- **Input:** Stock ticker (e.g., "RELIANCE")
- **Output:** Structured search queries for Domestic, Sectoral, and Global contexts
- **Optimization:** Query expansion with synonyms and related terms

### 2. **Scraper Swarm**
- **Responsibility:** Ingests 15+ sources of financial intelligence
- **Sources:** News, earnings calls, regulatory filings, analyst reports
- **Tiers:** 
  - Domestic: MoneyControl, Economic Times, LiveMint
  - Sectoral: Industry reports, competitor analysis
  - Global: Reuters, Bloomberg, Macro-economic indicators
- **Deduplication:** Cosine similarity-based semantic filtering

### 3. **Context Aggregator**
- **Responsibility:** Structures raw outputs into temporal relevance blocks
- **Function:** Organizes information chronologically and by impact relevance
- **Output:** Structured JSON with temporal metadata

### 4. **Deep-Analyst Agent**
- **Responsibility:** Performs factual induction—deducing specific impacts
- **Logic:** Maps macro events to Nifty 50 constituent impacts
- **Example:** "RBI rate hike" → Impacts to Banking, Auto, FMCG sectors
- **Output:** Analytical report with deductions and reasoning chains

### 5. **Factual Auditor Agent**
- **Responsibility:** Eliminates AI hallucinations through systematic fact-checking
- **Method:** Cross-references generated text against raw scraped data
- **Confidence:** Returns confidence scores for each claim
- **Output:** Audited report with fact-check annotations

### 6. **Portfolio Grader Agent**
- **Responsibility:** Translates unstructured reasoning into structured scores
- **Function:** Maps sentiment analysis to 5D coordinate space
- **Scoring:** Normalized [-1.0, +1.0] across all dimensions
- **Output:** JSON sentiment vector with individual dimension scores

---

## 5-Dimensional State Space Model

The system models market complexity across 5 orthogonal dimensions:

### Dimension 1: Price Action (P)
```
Formula: (Close - Open) / Open
Range: [-1.0 (Bearish) to +1.0 (Bullish)]
Interpretation: Daily return from open
```

### Dimension 2: Volume/Liquidity (V)
```
Formula: (Current Volume - 14-day MA) / 14-day MA
Range: [-1.0 (Low) to +1.0 (High)]
Interpretation: Volume surge relative to average
```

### Dimension 3: Volatility (Vol)
```
Formula: (Daily Range) / ATR(14)
Range: [-1.0 (Low) to +1.0 (High)]
Interpretation: Normalized volatility
```

### Dimension 4: Momentum (M)
```
Formula: (Close - SMA(20)) / Close
Range: [-1.0 (Bearish) to +1.0 (Bullish)]
Interpretation: Distance from moving average
```

### Dimension 5: Macro/Benchmark (Mac)
```
Formula: (Nifty50 Sentiment - 0) / Max Sentiment
Range: [-1.0 (Market Bearish) to +1.0 (Market Bullish)]
Interpretation: Broader market sentiment
```

### Decision Logic

```python
# Aggregated Score
aggregated_score = (P + V + Vol + M + Mac) / 5

# Final Decision
if aggregated_score > 0.5:
    recommendation = "BUY"
elif aggregated_score < -0.5:
    recommendation = "SELL"
else:
    recommendation = "HOLD"

confidence = abs(aggregated_score) * 100  # Percentage
```

---

## Configuration

### Stock Symbols

Edit `src/config/stocks.js`:

```javascript
export const NIFTY_50_SYMBOLS = [
  'RELIANCE.NS',
  'TCS.NS',
  'INFY.NS',
  'HDFC.NS',
  // ... add more stocks
];
```

### Market Hours

Edit `.env`:

```env
MARKET_OPEN=09:15
MARKET_CLOSE=15:30
POLLING_INTERVAL=10000  # milliseconds
```

### API Rate Limits

Edit `src/middleware/rateLimiter.js`:

```javascript
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100  // requests per window
});
```

### Cache Configuration

Edit `src/config/redis.js`:

```javascript
export const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true
};
```

---

## Documentation

### Comprehensive Documentation Files

- **[Requirement Analysis Report](./requirement_analysis_report.md)** - Complete Software Requirements Specification (SRS)
  - Functional requirements (FR-01 through FR-09)
  - Non-functional requirements
  - Algorithmic specifications
  - Data interface specifications

- **[Presentation Slides](./presentation_final_slides.md)** - Executive summary and overview
  - Problem motivation
  - Solution approach
  - Architecture visualization
  - Technology stack
  - Implementation status

- **[State Diagram](./state_diagram.md)** - UML state machine documentation
  - Real-time data worker states
  - Agentic advisor terminal states
  - State transitions and descriptions

- **[Use Case Diagram](./use_case_diagram.md)** - Actor interactions and use cases
  - 9 primary use cases
  - External system dependencies
  - Actor-use case relationships

### API Documentation

#### Authentication Endpoints

```
POST /api/auth/register
  - Body: { email, password }
  - Returns: JWT token

POST /api/auth/login
  - Body: { email, password }
  - Returns: JWT token
```

#### Market Endpoints

```
GET /api/market/live-prices
  - Returns: Current Nifty 50 prices

GET /api/market/candles/:symbol
  - Query: { interval, limit }
  - Returns: Historical OHLCV data
```

#### Order Endpoints

```
POST /api/orders/create
  - Body: { symbol, quantity, orderType, price }
  - Returns: Order confirmation

GET /api/orders/history
  - Returns: User's order history
```

#### Agent Endpoints

```
GET /api/agents/simulation/:symbol
  - Returns: streamed agent events, Monte Carlo distribution, action, and diagnostics

GET /api/agents/memory?symbol=:symbol
  - Returns: evaluated paper-decision memory and bounded calibration context
```

---

## Performance Metrics

No production latency, uptime, load, retrieval-accuracy, or hallucination claim is made without a reproducible benchmark artifact.

### Current chronological RELIANCE research result

| Metric | Observed result |
|---|---:|
| Non-overlapping 10-session test windows | 74 |
| Directional coverage | 17.57% |
| Directional accuracy | 61.54% |
| Position changes | 6 |
| Invested windows | 31.08% |
| Long-only policy return | -0.06% |
| Buy-and-hold return over evaluation span | +7.22% |
| Policy maximum drawdown | -18.42% |

This evidence does not pass a production gate. The API and UI therefore identify the policy as `RESEARCH_ONLY`, `NOT_PASSED`, and `is_reinforcement_learning: false`.

---

## Lessons Learned

### Technical Insights

1. **Separate explanation from policy:** Human-readable agent context and the quantitative decision rule require different state contracts and validation.

2. **Streaming needs explicit failure states:** A child process that exits without a result must emit a terminal error event; otherwise the UI remains indefinitely in a running state.

3. **Non-finite data must fail closed or become neutral:** Missing international-market observations previously propagated `NaN` into the action calculation.

4. **Historical Data Sufficiency:** No universal sufficiency claim is made. The live prototype uses five years when available and reports its effective neighbor count; production eligibility requires multi-regime, point-in-time data and walk-forward validation.

5. **Validation outranks model complexity:** A sophisticated label is not evidence. The current walk-forward portfolio result does not beat its baseline, so the model remains research-only.

### Architectural Insights

1. **Documentation is part of the model:** Equations, timestamps, cost assumptions, seeds, state semantics, and acceptance gates must agree with executable code.

2. **Modular Architecture:** Separating frontend, backend services, and AI engine as distinct modules enabled independent optimization without requiring full system integration for each iteration.

3. **Position state removes action ambiguity:** Buy, Sell, and Hold should be derived from previous and target exposure; Sell is an exit in the long-only environment, not an implicit short.

4. **Research and runtime are different lifecycles:** Offline training, evaluation, model registration, streaming inference, and paper execution should remain independently testable components.

### Project Insights

1. **Simulation Environment Benefits:** Focusing exclusively on simulation (not live broker integration) enabled rapid prototyping and testing without regulatory complexity or financial risk exposure.

2. **Open-source components improve inspectability:** They do not establish reliability without reproducible load, statistical, security, and operational evidence.

3. **User Feedback Value:** Early collection and incorporation of user feedback during development drove feature prioritization more effectively than upfront requirements estimation.

---

## Future Roadmap

### Immediate (Weeks 1-4)
- [ ] Production hardening and comprehensive testing
- [ ] Performance optimization for 100+ concurrent users
- [ ] Deployment on institutional hosting infrastructure
- [ ] Monitoring dashboard implementation

### Medium-Term (Months 2-3)
- [ ] Expand to multiple indices (Nifty 100, Nifty 500, sector-specific)
- [ ] Implement portfolio-level advisory (optimal allocation)
- [ ] Advanced comparative analysis across multiple stocks
- [ ] Enhanced backtesting with historical validation

### Long-Term (Months 4-12)
- [ ] Institutional adoption and integration with academic curriculum
- [ ] Open-source repository publication with community contributions
- [ ] Research paper publication on multi-agent reasoning and factual induction
- [ ] Commercial viability assessment for enterprise deployment
- [ ] Mobile application development
- [ ] Integration with additional data sources and alternative LLM providers

### Research Directions
- [ ] Transfer learning from historical analysis
- [ ] Federated learning across institutional deployments
- [ ] Reinforcement learning policy optimization
- [ ] Alternative NLP techniques for improved semantic understanding
- [ ] Causal inference for economic policy impact analysis

---

## Contributing

We welcome contributions from the community! 

### How to Contribute

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow existing code style and structure
- Add comprehensive comments for complex logic
- Write tests for new functionality
- Update documentation for feature changes
- Ensure <10 second latency for market data features

### Reporting Issues

Please report bugs and issues via GitHub Issues with:
- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, Node version, etc.)

---

## License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

### Technologies & Services
- **Google Cloud** - Gemini AI API for advanced reasoning
- **Tavily** - Deep search API for financial news
- **Yahoo Finance** - Market data through yahoo-finance2
- **MongoDB** - Cloud database services
- **Node.js Community** - Excellent open-source ecosystem

### Documentation & References
- UML and architectural patterns from institutional software engineering practices
- Financial mathematics from quantitative finance textbooks
- Multi-agent systems research from AI communities
- React and Node.js community documentation

---

## Support & Contact

For questions, suggestions, or support:

- 📧 **Email:** [Project Contact Email]
- 🐛 **Issues:** [GitHub Issues](https://github.com/yourusername/NiftyTradeSim/issues)
- 💬 **Discussions:** [GitHub Discussions](https://github.com/yourusername/NiftyTradeSim/discussions)
- 📚 **Documentation:** See `/docs` folder

---

## Project Status

**Current Phase:** Research Prototype | Paper Trading Only

- ✅ Core Functionality: Complete
- ✅ Context and market pipeline: Integrated for research use
- ⚠️ Real-Time Pipeline: Prototype; not independently load-tested
- ✅ Portfolio Management: Complete
- ⏳ Performance Optimization: In Progress
- ⏳ Production Deployment: Scheduled

---

**Last Updated:** April 23, 2026  
**Maintainer:** NiftyTradeSim Development Team  
**Repository:** [GitHub Link]

---

*This project demonstrates a paper-trading research architecture. It does not claim institutional-grade reliability or suitability for real-money execution.*

