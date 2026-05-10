from trading_framework.core.types import Candle, Signal, StrategyFunction


def buy_and_hold() -> StrategyFunction:
    def strategy(_candles: list[Candle], index: int) -> Signal:
        return "BUY" if index == 0 else "HOLD"

    return strategy
