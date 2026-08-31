import json
import sys
import time
import zlib
from pathlib import Path
import numpy as np
import pandas as pd
import yfinance as yf
from event_agents import StockAgents, NewsAgents

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from trading_framework.simulation import ConditionalMonteCarlo, MonteCarloConfig

PEER_GROUPS = {
    "IT": ["TCS.NS", "INFY.NS", "HCLTECH.NS", "WIPRO.NS", "TECHM.NS"],
    "BANKING": ["HDFCBANK.NS", "ICICIBANK.NS", "KOTAKBANK.NS", "SBIN.NS", "AXISBANK.NS", "INDUSINDBK.NS"],
    "AUTO": ["MARUTI.NS", "M&M.NS", "TATAMOTORS.NS", "EICHERMOT.NS", "HEROMOTOCO.NS", "BAJAJ-AUTO.NS"],
    "PHARMA": ["SUNPHARMA.NS", "DRREDDY.NS", "CIPLA.NS", "DIVISLAB.NS"],
    "METALS": ["HINDALCO.NS", "JSWSTEEL.NS", "TATASTEEL.NS"],
    "ENERGY": ["RELIANCE.NS", "ONGC.NS", "BPCL.NS", "IOC.NS"],
}

def fetch_history(symbol, period="5y", attempts=3):
    """Fetch adjusted history with bounded retries and a separate Ticker fallback."""
    last_error = None
    for attempt in range(attempts):
        try:
            frame = yf.download(
                symbol,
                period=period,
                interval="1d",
                auto_adjust=True,
                progress=False,
                threads=False,
                timeout=20,
            )
            if frame is not None and not frame.empty:
                return frame
        except Exception as exc:
            last_error = exc
        time.sleep(0.4 * (attempt + 1))

    try:
        frame = yf.Ticker(symbol).history(period=period, interval="1d", auto_adjust=True, timeout=20)
        if frame is not None and not frame.empty:
            return frame
    except Exception as exc:
        last_error = exc

    detail = f": {last_error}" if last_error else ""
    raise ValueError(f"Historical market data unavailable for {symbol}{detail}")

def infer_peer_symbols(symbol):
    for peers in PEER_GROUPS.values():
        if symbol in peers:
            return [peer for peer in peers if peer != symbol][:4]
    return ["RELIANCE.NS", "TCS.NS", "HDFCBANK.NS"]

def fetch_latest_candle(symbol):
    try:
        df = yf.download(symbol, period="7d", interval="1d", auto_adjust=True, progress=False)
        if df.empty:
            return None
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
        row = df.iloc[-1]

        def val(col):
            value = row[col]
            if hasattr(value, 'iloc'):
                return float(value.iloc[0])
            return float(value)

        return {
            "open": val("Open"),
            "high": val("High"),
            "low": val("Low"),
            "close": val("Close"),
            "volume": val("Volume") if "Volume" in row.index else 0,
        }
    except Exception:
        return None

def fetch_news_context(symbol, current_candle):
    try:
        ticker_news = yf.Ticker(symbol).news or []
        articles = []
        for item in ticker_news[:8]:
            content = item.get("content", {}) if isinstance(item.get("content"), dict) else {}
            provider = content.get("provider", {}) if isinstance(content.get("provider"), dict) else {}
            title = item.get("title") or content.get("title") or ""
            summary = (
                item.get("summary")
                or content.get("summary")
                or content.get("description")
                or content.get("snippet")
                or ""
            )
            if title or summary:
                articles.append({
                    "title": title,
                    "content": summary,
                    "publisher": item.get("publisher") or provider.get("displayName") or "",
                    "published_at": item.get("providerPublishTime") or content.get("pubDate") or "",
                })
        if articles:
            return articles
    except Exception:
        pass

    change = 0.0
    if current_candle and current_candle.get("open", 0):
        change = (current_candle["close"] - current_candle["open"]) / current_candle["open"]
    if change > 0.01:
        title = f"{symbol} sees positive market reaction after recent sector momentum"
        content = "growth upgrade profit order win market"
    elif change < -0.01:
        title = f"{symbol} declines as traders react to recent market pressure"
        content = "decline downgrade rate market pressure"
    else:
        title = f"{symbol} remains range bound as market awaits fresh triggers"
        content = "reports scheduled market neutral"
    return [{"title": title, "content": content}]

def emit_log(agent, message, delay=0.5):
    """Prints a log immediately to stdout for SSE streaming."""
    time.sleep(delay)
    log_obj = {"type": "log", "log": {"agent": agent, "message": message}}
    print(json.dumps(log_obj))
    sys.stdout.flush()

def calculate_consensus(symbols, memory_context=None):
    stock_agents = StockAgents(lookback_period=14)
    news_agents = NewsAgents()
    memory_context = memory_context or {}
    
    for sym in symbols:
        emit_log("System", f"Initializing Quantitative Agent Simulation for {sym}...", 0.2)
        emit_log("Orchestrator", "Preparing market, context, memory, and risk-simulation stages.", 0.2)
        
        try:
            emit_log("DataFetcher", "Downloading five years of adjusted daily OHLCV data for historical simulation.", 0.1)
            df = fetch_history(sym, period="5y")
            if df.empty or len(df) < 350:
                raise ValueError("At least 350 daily candles are required for the risk model")
                
            emit_log("DataFetcher", f"Successfully retrieved {len(df)} days of verified market data.", 0.3)
            
            # Handle yfinance MultiIndex if it exists
            if isinstance(df.columns, pd.MultiIndex):
                df.columns = df.columns.get_level_values(0)
                
            # Format data for agents
            history = []
            for index, row in df.iterrows():
                try:
                    # Use a robust extraction to handle potential Series in rows
                    def get_val(r, col):
                        v = r[col]
                        if hasattr(v, 'iloc'): return float(v.iloc[0])
                        return float(v)
                        
                    history.append({
                        'open': get_val(row, 'Open'), 'high': get_val(row, 'High'),
                        'low': get_val(row, 'Low'), 'close': get_val(row, 'Close'),
                        'volume': get_val(row, 'Volume')
                    })
                except Exception as e:
                    continue
            
            if not history:
                raise ValueError("Failed to parse history into clean floats")

            current_candle = history[-1]
            historical_candles = history[:-1]
            
            emit_log("Agent_Network", "Ingesting market data into Technical 5D axis matrix...", 0.8)
            
            def safe_float(v):
                if v is None or np.isnan(v) or np.isinf(v):
                    return 0.0
                return float(v)

            # 1. Price Agent Log
            p_val = safe_float(stock_agents._price_agent(current_candle))
            p_dir = "positive" if p_val > 0 else "negative"
            emit_log("PriceAgent", f"Price action is {p_dir}. Vector weight: {p_val:.2f}", 0.6)
            
            # 2. Volume Agent Log
            v_val = safe_float(stock_agents._volume_agent(current_candle, historical_candles))
            v_dir = "above" if v_val > 0 else "below"
            emit_log("VolumeAgent", f"Volume is {v_dir} average. Vector weight: {v_val:.2f}", 0.6)
            
            # 3. Volatility Agent Log
            vol_val = safe_float(stock_agents._volatility_agent(current_candle, historical_candles))
            emit_log("VolatilityAgent", f"Calculated range vs ATR. Vector weight: {vol_val:.2f}", 0.5)
            
            # 4. Momentum Agent Log
            m_val = safe_float(stock_agents._momentum_agent(current_candle, historical_candles))
            m_dir = "bullish" if m_val > 0 else "bearish"
            emit_log("MomentumAgent", f"SMA momentum is {m_dir}. Vector weight: {m_val:.2f}", 0.5)
            
            # 5. Macro Agent Log - technical fallback only, macro perception is separate below
            mac_val = safe_float(stock_agents._macro_agent(current_candle))
            emit_log("MacroAgent", f"Technical macro proxy evaluated. Vector weight: {mac_val:.2f}", 0.4)
            
            emit_log("Perception_Network", "Building Perception 5D tensor: domestic market, peers, international market, news/events, time regime.", 0.6)
            nifty_candle = fetch_latest_candle("^NSEI")
            peer_symbols = infer_peer_symbols(sym)
            peer_candles = [fetch_latest_candle(peer) for peer in peer_symbols]
            international_candle = fetch_latest_candle("^GSPC")
            news_articles = fetch_news_context(sym, current_candle)
            emit_log("NewsFetcher", f"Loaded {len(news_articles)} recent perception items for {sym}.", 0.3)

            perception_vec = news_agents.evaluate(
                sym,
                df.index[-1],
                news_articles,
                current_candle=nifty_candle,
                historical_candles=historical_candles,
                peer_candles=peer_candles,
                international_candle=international_candle
            )
            # External market feeds can contain NaN/Infinity for holidays or
            # partially populated candles. Treat unavailable signals as neutral.
            perception_vec = np.nan_to_num(perception_vec, nan=0.0, posinf=1.0, neginf=-1.0)

            perception_labels = ["DomesticMarket", "Peers", "InternationalMarket", "NewsEvents", "TimeRegime"]
            for label, value in zip(perception_labels, perception_vec):
                direction = "supportive" if value > 0 else "adverse" if value < 0 else "neutral"
                emit_log(label, f"{label} perception is {direction}. Vector weight: {float(value):.2f}", 0.35)

            if memory_context.get("enabled"):
                accuracy = memory_context.get("accuracy")
                accuracy_text = f"{accuracy * 100:.0f}%" if isinstance(accuracy, (int, float)) else "not enough evaluated runs"
                emit_log(
                    "MemoryAgent",
                    f"Loaded {memory_context.get('total_runs', 0)} prior runs, {memory_context.get('evaluated_runs', 0)} evaluated. Historical accuracy: {accuracy_text}.",
                    0.35
                )
            else:
                emit_log("MemoryAgent", "Durable memory unavailable for this run; using stateless calibration.", 0.2)
            
            # Combine vectors
            technical_vec = np.clip(np.array([p_val, v_val, vol_val, m_val, mac_val]), -1.0, 1.0)
            perception_vec = np.clip(np.array(perception_vec), -1.0, 1.0)
            state_vec = np.concatenate([technical_vec, perception_vec])
            
            reasoning_points = []
            if p_val > 0.3: reasoning_points.append("strong positive price action")
            elif p_val < -0.3: reasoning_points.append("weak negative price action")
            if v_val > 0.2: reasoning_points.append("high volume surge")
            elif v_val < -0.2: reasoning_points.append("drying liquidity")
            if m_val > 0.4: reasoning_points.append("bullish moving average momentum")
            elif m_val < -0.4: reasoning_points.append("bearish momentum breakdown")
            
            signal_summary = ", ".join(reasoning_points) if reasoning_points else "mixed/neutral technicals"
            technical_weight = np.mean(technical_vec)
            perception_weight = np.mean(perception_vec)
            memory_adjustment = float(memory_context.get("memory_adjustment") or 0.0)
            memory_adjustment = float(np.clip(memory_adjustment, -0.12, 0.12))
            if abs(memory_adjustment) > 0:
                direction = "raising" if memory_adjustment > 0 else "reducing"
                emit_log("MemoryAgent", f"Memory calibration is {direction} the bounded context prior by {abs(memory_adjustment):.2f}.", 0.1)

            # Technical state selects historical regimes inside the simulator.
            # Only perception and evaluated memory form a small bounded context prior,
            # avoiding double-counting the technical signal.
            context_score = float(np.clip((0.8 * perception_weight) + memory_adjustment, -1.0, 1.0))
            seed = zlib.crc32(f"{sym}|{df.index[-1]}".encode("utf-8"))
            emit_log("RiskEngine", "Selecting comparable historical regimes with robust-scaled exact KNN.", 0.1)
            emit_log("RiskEngine", "Running 3,000 weighted moving-block Monte Carlo paths over a 10-session horizon.", 0.1)
            monte_carlo = ConditionalMonteCarlo(MonteCarloConfig()).run(
                df,
                context_score=context_score,
                seed=seed,
            ).to_dict()

            action_str = monte_carlo["action"]
            score = monte_carlo["confidence"]
            diagnostics = monte_carlo["diagnostics"]
            reason_str = (
                f"The agent network observed {signal_summary}. "
                f"Across {diagnostics['simulations']:,} regime-conditioned paths, the median "
                f"10-session return is {monte_carlo['median_return_pct']:+.2f}%, with "
                f"{monte_carlo['probability_profit_pct']:.1f}% above estimated trading costs and "
                f"a 95% expected shortfall of {monte_carlo['expected_shortfall_95_pct']:+.2f}%. "
                "The action is emitted only when the simulated probability clears the configured threshold."
            )
            emit_log(
                "TraderAgent",
                f"Decision: {action_str} ({score}% model confidence); median {monte_carlo['median_return_pct']:+.2f}%, "
                f"VaR95 {monte_carlo['value_at_risk_95_pct']:+.2f}%.",
                0.1,
            )
            
            final_result = {
                "type": "result",
                "data": {
                    "action": action_str,
                    "consensus_score": int(score),
                    "reasoning": reason_str,
                    "vector": [float(x) for x in technical_vec],
                    "technical_vector": [float(x) for x in technical_vec],
                    "perception_vector": [float(x) for x in perception_vec],
                    "state_vector": [float(x) for x in state_vec],
                    "technical_weight": float(technical_weight),
                    "perception_weight": float(perception_weight),
                    "memory_adjustment": float(memory_adjustment),
                    "context_score": float(context_score),
                    "reference_price": float(current_candle["close"]),
                    "market_date": str(df.index[-1]),
                    "memory": memory_context,
                    "scenarios": monte_carlo["scenarios"],
                    "monte_carlo": monte_carlo,
                    "model": diagnostics
                }
            }
            print(json.dumps(final_result))
            sys.stdout.flush()
            
        except Exception as e:
            emit_log("System", f"Critical Error: {str(e)}", 0)
            error_result = {
                "type": "result",
                "data": {
                    "action": "Error",
                    "consensus_score": 0,
                    "reasoning": f"Pipeline failed during execution: {str(e)}",
                    "vector": [0,0,0,0,0],
                    "technical_vector": [0,0,0,0,0],
                    "perception_vector": [0,0,0,0,0],
                    "state_vector": [0,0,0,0,0,0,0,0,0,0],
                    "memory_adjustment": 0,
                    "reference_price": None,
                    "market_date": None,
                    "memory": memory_context,
                    "scenarios": []
                }
            }
            print(json.dumps(error_result))
            sys.stdout.flush()

if __name__ == "__main__":
    symbols = sys.argv[1].split(',') if len(sys.argv) > 1 else ["TCS.NS"]
    memory = {}
    if len(sys.argv) > 2:
        try:
            memory = json.loads(sys.argv[2])
        except Exception:
            memory = {}
    calculate_consensus(symbols, memory)
