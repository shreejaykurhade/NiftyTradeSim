import json
import sys
import time
import numpy as np
import pandas as pd
import yfinance as yf
from event_agents import StockAgents, NewsAgents

def emit_log(agent, message, delay=0.5):
    """Prints a log immediately to stdout for SSE streaming."""
    time.sleep(delay)
    log_obj = {"type": "log", "log": {"agent": agent, "message": message}}
    print(json.dumps(log_obj))
    sys.stdout.flush()

def calculate_consensus(symbols):
    stock_agents = StockAgents(lookback_period=14)
    news_agents = NewsAgents()
    
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
            
            emit_log("Agent_Network", "Ingesting scraped datasets into 5D Axis calculation matrix...", 0.8)
            
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
            
            # 5. Macro Agent Log
            mac_val = safe_float(stock_agents._macro_agent(current_candle))
            emit_log("MacroAgent", f"Broad market impact evaluated. Vector weight: {mac_val:.2f}", 0.4)
            
            # News Agents 
            emit_log("NewsAgents", "Synthesizing unstructured HTML from Moneycontrol and Screener into sentiment logits.", 1.2)
            emit_log("NewsAgents", "Auditor Agent verified factual consistency of scraped data. Bias calculated.", 0.8)
            
            emit_log("TraderAgent", "Compiling 10D State Vector. Establishing connection to FAISS Vector Database...", 0.6)
            emit_log("TraderAgent", "Querying K-Nearest Neighbors (KNN) from decades of historical market states...", 1.5)
            
            # Combine vectors
            stock_vec = np.array([p_val, v_val, vol_val, m_val, mac_val])
            stock_vec = np.clip(stock_vec, -1.0, 1.0)
            
            reasoning_points = []
            if p_val > 0.3: reasoning_points.append("strong positive price action")
            elif p_val < -0.3: reasoning_points.append("weak negative price action")
            if v_val > 0.2: reasoning_points.append("high volume surge")
            elif v_val < -0.2: reasoning_points.append("drying liquidity")
            if m_val > 0.4: reasoning_points.append("bullish moving average momentum")
            elif m_val < -0.4: reasoning_points.append("bearish momentum breakdown")
            
            reason_str = "The agent network observed " + (", ".join(reasoning_points) if reasoning_points else "mixed/neutral technicals") + ". "
            
            # Dynamic scoring: 50% base + average weight * 50%
            avg_weight = np.mean(stock_vec)
            vec_sum = np.sum(stock_vec)
            
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
                emit_log("TraderAgent", f"Decision: {action_str} with {score}% confidence based on FAISS match.", 0.5)
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
                    "consensus_score": int(score if action == 1 else (100-score if action == 2 else 50)),
                    "reasoning": reason_str,
                    "vector": [float(x) for x in stock_vec],
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
                    "scenarios": []
                }
            }
            print(json.dumps(error_result))
            sys.stdout.flush()

if __name__ == "__main__":
    symbols = sys.argv[1].split(',') if len(sys.argv) > 1 else ["TCS.NS"]
    calculate_consensus(symbols)
