from .mean_reversion import rsi_mean_reversion
from .momentum import breakout_momentum
from .passive import buy_and_hold
from .trend import moving_average_crossover

STRATEGY_REGISTRY = {
    "buy_and_hold": buy_and_hold,
    "moving_average_crossover": moving_average_crossover,
    "rsi_mean_reversion": rsi_mean_reversion,
    "breakout_momentum": breakout_momentum,
}
