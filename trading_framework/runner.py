import argparse
import json
import sys

from trading_framework.backtesting import BacktestConfig, run_backtest
from trading_framework.strategies import STRATEGY_REGISTRY


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run a strategy backtest from JSON candle input.")
    parser.add_argument("--strategy", required=True, choices=sorted(STRATEGY_REGISTRY.keys()))
    parser.add_argument("--starting-cash", type=float, default=1_000_000.0)
    parser.add_argument("--position-size-pct", type=float, default=1.0)
    parser.add_argument("--fee-rate", type=float, default=0.0)
    parser.add_argument("--params", default="{}", help="JSON object passed to strategy factory")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    payload = json.load(sys.stdin)
    candles = payload.get("candles", [])
    params = json.loads(args.params)

    strategy_factory = STRATEGY_REGISTRY[args.strategy]
    strategy = strategy_factory(**params)
    result = run_backtest(
        candles,
        strategy,
        config=BacktestConfig(
            starting_cash=args.starting_cash,
            position_size_pct=args.position_size_pct,
            fee_rate=args.fee_rate,
        ),
    )

    print(json.dumps({
        "finalCash": result.final_cash,
        "finalPosition": result.final_position,
        "finalPrice": result.final_price,
        "finalValue": result.final_value,
        "metrics": result.metrics.__dict__ if result.metrics else None,
        "trades": [trade.__dict__ for trade in result.trades],
        "equityCurve": [point.__dict__ for point in result.equity_curve],
    }))


if __name__ == "__main__":
    main()
