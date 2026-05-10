# Strategies

Strategy modules produce trading signals. They should not mutate portfolio state, create trades, or calculate final performance.

Recommended structure:

- `passive.py` for baselines such as buy-and-hold
- `trend.py` for trend-following and moving-average systems
- `mean_reversion.py` for RSI, z-score, and pullback systems
- `momentum.py` for breakout and relative-strength ideas
- `registry.py` for naming strategies consistently in experiments

This separation keeps strategy research scalable: a new quant technique should be a new strategy module or function, not a change to the backtesting engine.
