from .models import BacktestMetrics, EquityPoint, Trade


def calculate_metrics(starting_cash: float, equity_curve: list[EquityPoint], trades: list[Trade]) -> BacktestMetrics:
    if not equity_curve:
        return BacktestMetrics(total_return_pct=0, max_drawdown_pct=0, trade_count=0, win_rate_pct=0)

    final_value = equity_curve[-1].value
    total_return_pct = ((final_value - starting_cash) / starting_cash) * 100
    max_drawdown_pct = _max_drawdown(equity_curve)
    win_rate_pct = _win_rate(trades)

    return BacktestMetrics(
        total_return_pct=round(total_return_pct, 2),
        max_drawdown_pct=round(max_drawdown_pct, 2),
        trade_count=len(trades),
        win_rate_pct=round(win_rate_pct, 2),
    )


def _max_drawdown(equity_curve: list[EquityPoint]) -> float:
    peak = equity_curve[0].value
    worst = 0.0

    for point in equity_curve:
        peak = max(peak, point.value)
        if peak > 0:
            drawdown = ((point.value - peak) / peak) * 100
            worst = min(worst, drawdown)

    return worst


def _win_rate(trades: list[Trade]) -> float:
    completed = []
    open_buy: Trade | None = None

    for trade in trades:
        if trade.side == "BUY":
            open_buy = trade
        elif trade.side == "SELL" and open_buy:
            completed.append(trade.price > open_buy.price)
            open_buy = None

    if not completed:
        return 0.0
    return (sum(1 for won in completed if won) / len(completed)) * 100
