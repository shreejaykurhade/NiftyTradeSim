from trading_framework.core.types import Candle, Signal, StrategyFunction


def rsi_mean_reversion(period: int = 14, buy_below: float = 30, sell_above: float = 60) -> StrategyFunction:
    if period <= 1:
        raise ValueError("period must be greater than 1")
    if buy_below >= sell_above:
        raise ValueError("buy_below must be lower than sell_above")

    def strategy(candles: list[Candle], index: int) -> Signal:
        if index < period:
            return "HOLD"
        value = _rsi(candles, index, period)
        if value < buy_below:
            return "BUY"
        if value > sell_above:
            return "SELL"
        return "HOLD"

    return strategy


def _rsi(candles: list[Candle], index: int, period: int) -> float:
    gains = 0.0
    losses = 0.0

    for cursor in range(index - period + 1, index + 1):
        change = float(candles[cursor]["close"]) - float(candles[cursor - 1]["close"])
        if change >= 0:
            gains += change
        else:
            losses += abs(change)

    if losses == 0:
        return 100.0

    relative_strength = (gains / period) / (losses / period)
    return 100 - (100 / (1 + relative_strength))
