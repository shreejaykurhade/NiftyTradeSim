from trading_framework.core.types import Candle, Signal, StrategyFunction


def moving_average_crossover(short_window: int = 20, long_window: int = 50) -> StrategyFunction:
    if short_window <= 0 or long_window <= 0 or short_window >= long_window:
        raise ValueError("Use positive windows with short_window < long_window")

    def strategy(candles: list[Candle], index: int) -> Signal:
        if index < long_window:
            return "HOLD"

        prev_short = _average_close(candles, index - 1, short_window)
        prev_long = _average_close(candles, index - 1, long_window)
        curr_short = _average_close(candles, index, short_window)
        curr_long = _average_close(candles, index, long_window)

        if prev_short <= prev_long and curr_short > curr_long:
            return "BUY"
        if prev_short >= prev_long and curr_short < curr_long:
            return "SELL"
        return "HOLD"

    return strategy


def _average_close(candles: list[Candle], end: int, window: int) -> float:
    sample = candles[end - window + 1:end + 1]
    return sum(float(candle["close"]) for candle in sample) / window
