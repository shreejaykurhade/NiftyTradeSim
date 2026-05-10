# Backtesting

Reusable backtesting infrastructure for the paper-trading platform.

This folder should contain engine/runtime code only:

- portfolio accounting
- fills and transaction costs
- equity curve generation
- metrics and analyzers
- result models

Strategies do not live here. A strategy should produce `BUY`, `SELL`, or `HOLD`; the backtesting engine decides how that signal affects cash, positions, trades, and performance.

## Example

```python
from trading_framework.backtesting import BacktestConfig, run_backtest
from trading_framework.strategies import moving_average_crossover

result = run_backtest(
    candles,
    moving_average_crossover(short_window=20, long_window=50),
    config=BacktestConfig(starting_cash=1_000_000),
)

print(result.final_value, result.metrics.total_return_pct)
```
