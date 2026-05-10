from collections.abc import Callable
from typing import Literal, TypedDict

Signal = Literal["BUY", "SELL", "HOLD"]


class Candle(TypedDict, total=False):
    time: int | str
    open: float
    high: float
    low: float
    close: float
    volume: float


StrategyFunction = Callable[[list[Candle], int], Signal]
