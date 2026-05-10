from trading_framework.backtesting import BacktestConfig, run_backtest
from trading_framework.strategies import buy_and_hold


def main() -> None:
    candles = [
        {"open": 100 + index, "high": 102 + index, "low": 99 + index, "close": 101 + index, "volume": 1000}
        for index in range(80)
    ]

    result = run_backtest(
        candles,
        buy_and_hold(),
        config=BacktestConfig(starting_cash=100_000, fee_rate=0.001),
    )

    print({
        "final_value": result.final_value,
        "total_return_pct": result.metrics.total_return_pct if result.metrics else 0,
        "trade_count": result.metrics.trade_count if result.metrics else 0,
    })


if __name__ == "__main__":
    main()
