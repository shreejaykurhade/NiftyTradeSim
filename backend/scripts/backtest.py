import json
import argparse
from datetime import datetime
from event_agents import StockAgents, NewsAgents
from monte_carlo_rl import MonteCarloRLAgent
import numpy as np

def run_backtest(symbol, start_date, end_date):
    raise RuntimeError(
        "The hard-coded legacy RL backtest has been disabled. "
        "Use evaluate_monte_carlo.py for chronological policy evaluation or "
        "trading_framework.runner for executable strategy backtests."
    )

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--symbol", type=str, required=True)
    parser.add_argument("--start_date", type=str, required=True)
    parser.add_argument("--end_date", type=str, required=True)
    args = parser.parse_args()
    
    run_backtest(args.symbol, args.start_date, args.end_date)
