from trading_framework.core.types import Candle, Signal, StrategyFunction


def breakout_momentum(lookback: int = 20, exit_lookback: int = 10) -> StrategyFunction:
    if lookback <= 1 or exit_lookback <= 1:
        raise ValueError("lookback values must be greater than 1")

    def strategy(candles: list[Candle], index: int) -> Signal:
        if index < lookback:
            return "HOLD"

        close = float(candles[index]["close"])
        prior_window = candles[index - lookback:index]
        breakout_high = max(float(candle["high"]) for candle in prior_window)

        exit_start = max(0, index - exit_lookback)
        exit_low = min(float(candle["low"]) for candle in candles[exit_start:index])

        if close > breakout_high:
            return "BUY"
        if close < exit_low:
            return "SELL"
        return "HOLD"

    return strategy
