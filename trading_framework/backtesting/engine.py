from collections.abc import Callable, Iterable

from .metrics import calculate_metrics
from .models import BacktestConfig, BacktestResult, EquityPoint, Trade
from .portfolio import Portfolio
from trading_framework.core.types import Candle, Signal


def run_backtest(
    candles: Iterable[Candle],
    strategy: Callable[[list[Candle], int], Signal],
    *,
    config: BacktestConfig | None = None,
) -> BacktestResult:
    """Run a deterministic long-only backtest over OHLC candles."""
    config = config or BacktestConfig()
    series = list(candles)
    if not series:
        raise ValueError("Backtest requires at least one candle")

    portfolio = Portfolio(config.starting_cash)
    trades: list[Trade] = []
    equity_curve: list[EquityPoint] = []

    for index, candle in enumerate(series):
        price = _close_price(candle)
        signal = strategy(series, index)

        if signal == "BUY" and portfolio.position == 0:
            trade = portfolio.buy(index, price, config.position_size_pct, config.fee_rate)
            if trade:
                trades.append(trade)

        elif signal == "SELL" and portfolio.position > 0:
            trades.append(portfolio.sell(index, price, config.fee_rate))

        equity_curve.append(portfolio.mark_to_market(index, price))

    final_price = _close_price(series[-1])
    final_value = portfolio.value(final_price)
    metrics = calculate_metrics(config.starting_cash, equity_curve, trades)

    return BacktestResult(
        config=config,
        final_cash=round(portfolio.cash, 2),
        final_position=portfolio.position,
        final_price=round(final_price, 2),
        final_value=round(final_value, 2),
        trades=trades,
        equity_curve=equity_curve,
        metrics=metrics,
    )


def _close_price(candle: Candle) -> float:
    price = float(candle["close"])
    if price <= 0:
        raise ValueError("Candle close must be positive")
    return price
