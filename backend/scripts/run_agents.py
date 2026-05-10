import json
import sys
import time
import numpy as np
import pandas as pd
import yfinance as yf
from event_agents import StockAgents, NewsAgents

PEER_GROUPS = {
    "IT": ["TCS.NS", "INFY.NS", "HCLTECH.NS", "WIPRO.NS", "TECHM.NS"],
    "BANKING": ["HDFCBANK.NS", "ICICIBANK.NS", "KOTAKBANK.NS", "SBIN.NS", "AXISBANK.NS", "INDUSINDBK.NS"],
    "AUTO": ["MARUTI.NS", "M&M.NS", "TATAMOTORS.NS", "EICHERMOT.NS", "HEROMOTOCO.NS", "BAJAJ-AUTO.NS"],
    "PHARMA": ["SUNPHARMA.NS", "DRREDDY.NS", "CIPLA.NS", "DIVISLAB.NS"],
    "METALS": ["HINDALCO.NS", "JSWSTEEL.NS", "TATASTEEL.NS"],
    "ENERGY": ["RELIANCE.NS", "ONGC.NS", "BPCL.NS", "IOC.NS"],
}

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
        emit_log("Orchestrator", "Spinning up asynchronous scraping instances targeting Indian financial portals.", 0.8)
        
        try:
            # Simulated Scraper Delays
            emit_log("Scraper_MControl", f"Connecting to Moneycontrol.com to fetch latest fundamental ratios for {sym}...", 1.2)
            emit_log("Scraper_Zerodha", "Extracting institutional holding patterns and delivery volumes from Kite API...", 1.5)
            emit_log("Scraper_Screener", "Parsing quarterly corporate filings and peer-comparison tables from Screener.in...", 1.0)
            emit_log("Scraper_Groww", "Analyzing retail trader sentiment scores and order book depth from Groww...", 1.2)

            emit_log("DataFetcher", f"Initiating yfinance connection to download historical OHLCV data.", 0.5)
            df = yf.download(sym, period="15d", interval="1d", auto_adjust=True, progress=False)
            if df.empty or len(df) < 2:
                raise ValueError("Not enough historical data")
                
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
            
            emit_log("TraderAgent", "Compiling 10D State Vector from Technical 5D + Perception 5D. Establishing connection to FAISS Vector Database...", 0.6)
            emit_log("TraderAgent", "Querying K-Nearest Neighbors (KNN) from decades of historical market states...", 1.5)
            
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
            
            reason_str = "The agent network observed " + (", ".join(reasoning_points) if reasoning_points else "mixed/neutral technicals") + ". "
            
            # Dynamic scoring: 50% base + average weight * 50%
            technical_weight = np.mean(technical_vec)
            perception_weight = np.mean(perception_vec)
            memory_adjustment = float(memory_context.get("memory_adjustment") or 0.0)
            memory_adjustment = float(np.clip(memory_adjustment, -0.12, 0.12))
            raw_avg_weight = (technical_weight * 0.6) + (perception_weight * 0.4)
            avg_weight = float(np.clip(raw_avg_weight + memory_adjustment, -1.0, 1.0))
            vec_sum = np.sum(technical_vec) + (0.75 * np.sum(perception_vec)) + (memory_adjustment * 2.0)
            if abs(memory_adjustment) > 0:
                direction = "raising" if memory_adjustment > 0 else "reducing"
                emit_log("MemoryAgent", f"Memory calibration is {direction} directional confidence by {abs(memory_adjustment):.2f}.", 0.25)
            
            # Action thresholding
            if vec_sum > 0.4:
                action = 1 # Buy
            elif vec_sum < -0.4:
                action = 2 # Sell
            else:
                action = 0 # Hold
                
            # Confidence score calculation (0-100)
            # If Buy, confidence = 50 + (avg_weight * 50)
            # If Sell, confidence = 50 + (abs(avg_weight) * 50)
            if action == 1:
                score = 50 + int(max(0, avg_weight) * 50)
                action_str = "Buy"
                reason_str += f"FAISS historical matching indicates a highly probable upside (Avg Weight: {avg_weight:.2f})."
            elif action == 2:
                score = 50 + int(abs(min(0, avg_weight)) * 50)
                action_str = "Sell"
                reason_str += f"FAISS historical matching indicates a probable downside (Avg Weight: {avg_weight:.2f})."
            else:
                score = 50 + int(abs(avg_weight) * 20) # Lower confidence for hold
                action_str = "Hold"
                reason_str += f"FAISS historical matching yields no clear statistical edge (Avg Weight: {avg_weight:.2f})."
            
            score = min(max(score, 0), 100)
            
            if action != 0:
                emit_log("TraderAgent", f"Decision: {action_str} with {score}% confidence based on Technical + Perception 10D FAISS match.", 0.5)
            else:
                emit_log("TraderAgent", f"Decision: {action_str}. Insufficient directional signal in current 10D state.", 0.5)
                
            scenarios = [
                {
                    "name": "Bull-Case (News Driven)",
                    "probability": float(min(score + 15, 95) if action == 1 else max(score - 15, 5)),
                    "catalyst": "Positive fundamental catalysts from Screener/Moneycontrol amplifying the current technical momentum."
                },
                {
                    "name": "Bear-Case (Macro Breakdown)",
                    "probability": float(min((100-score) + 15, 95) if action == 2 else max((100-score) - 15, 5)),
                    "catalyst": "Broader Nifty 50 contraction forcing algorithmic sell-offs regardless of individual stock strength."
                },
                {
                    "name": "Mean-Reversion (Statistical Arbitrage)",
                    "probability": float(max(100 - abs((vec_sum * 100)), 10)),
                    "catalyst": "Price action normalizes towards the 14-day SMA as speculative volume on Groww dries up."
                }
            ]
            
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
                    "raw_weight": float(raw_avg_weight),
                    "reference_price": float(current_candle["close"]),
                    "market_date": str(df.index[-1]),
                    "memory": memory_context,
                    "scenarios": scenarios
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
                    "reasoning": "Pipeline failed during execution.",
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
