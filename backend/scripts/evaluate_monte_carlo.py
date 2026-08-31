"""Run a chronological out-of-sample evaluation for one paper-trading symbol."""

import argparse
import json
import sys
from pathlib import Path

import pandas as pd
import yfinance as yf

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from trading_framework.simulation import MonteCarloConfig, walk_forward_evaluate


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--symbol", required=True)
    parser.add_argument("--period", default="5y")
    parser.add_argument("--step-days", type=int, default=10)
    args = parser.parse_args()

    candles = yf.download(
        args.symbol,
        period=args.period,
        interval="1d",
        auto_adjust=True,
        progress=False,
        threads=False,
    )
    if isinstance(candles.columns, pd.MultiIndex):
        candles.columns = candles.columns.get_level_values(0)
    result = walk_forward_evaluate(
        candles,
        config=MonteCarloConfig(simulations=500),
        step_days=args.step_days,
    )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
