from dataclasses import dataclass, field


@dataclass(frozen=True)
class BacktestConfig:
    starting_cash: float = 1_000_000.0
    position_size_pct: float = 1.0
    fee_rate: float = 0.0

    def __post_init__(self) -> None:
        if self.starting_cash <= 0:
            raise ValueError("starting_cash must be positive")
        if not 0 < self.position_size_pct <= 1:
            raise ValueError("position_size_pct must be between 0 and 1")
        if self.fee_rate < 0:
            raise ValueError("fee_rate cannot be negative")


@dataclass(frozen=True)
class Trade:
    index: int
    side: str
    quantity: int
    price: float
    gross_total: float
    fee: float
    net_total: float


@dataclass(frozen=True)
class EquityPoint:
    index: int
    cash: float
    position: int
    price: float
    value: float


@dataclass(frozen=True)
class BacktestMetrics:
    total_return_pct: float
    max_drawdown_pct: float
    trade_count: int
    win_rate_pct: float


@dataclass(frozen=True)
class BacktestResult:
    config: BacktestConfig
    final_cash: float
    final_position: int
    final_price: float
    final_value: float
    trades: list[Trade] = field(default_factory=list)
    equity_curve: list[EquityPoint] = field(default_factory=list)
    metrics: BacktestMetrics | None = None
