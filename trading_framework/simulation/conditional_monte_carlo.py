"""Regime-conditioned historical Monte Carlo simulation.

This module is intentionally a forecasting/risk engine, not reinforcement
learning. It selects past market regimes without using future information,
resamples their subsequent return blocks, and reports a distribution rather
than a single-point forecast.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any

import numpy as np
import pandas as pd

try:
    import faiss
except ImportError:  # Small datasets can use the exact NumPy fallback.
    faiss = None


FEATURE_NAMES = (
    "return_1d",
    "return_5d",
    "momentum_20d",
    "trend_20_60d",
    "volatility_20d",
    "volatility_regime",
    "drawdown_60d",
    "volume_shock",
)


@dataclass(frozen=True)
class MonteCarloConfig:
    horizon_days: int = 10
    simulations: int = 3_000
    neighbor_count: int = 80
    block_size: int = 3
    min_history: int = 252
    transaction_cost_bps: float = 15.0
    decision_probability: float = 0.58
    context_impact_bps: float = 25.0

    def __post_init__(self) -> None:
        if self.horizon_days < 2:
            raise ValueError("horizon_days must be at least 2")
        if self.simulations < 500:
            raise ValueError("simulations must be at least 500")
        if self.neighbor_count < 20:
            raise ValueError("neighbor_count must be at least 20")
        if not 1 <= self.block_size <= self.horizon_days:
            raise ValueError("block_size must be between 1 and horizon_days")
        if not 0.5 < self.decision_probability < 1:
            raise ValueError("decision_probability must be between 0.5 and 1")


@dataclass(frozen=True)
class MonteCarloResult:
    action: str
    confidence: int
    expected_return_pct: float
    median_return_pct: float
    probability_profit_pct: float
    probability_loss_pct: float
    value_at_risk_95_pct: float
    expected_shortfall_95_pct: float
    expected_max_drawdown_pct: float
    scenarios: list[dict[str, Any]]
    diagnostics: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class ConditionalMonteCarlo:
    """Exact-regime KNN plus weighted moving-block return bootstrap."""

    def __init__(self, config: MonteCarloConfig | None = None) -> None:
        self.config = config or MonteCarloConfig()

    def run(
        self,
        candles: pd.DataFrame,
        *,
        context_score: float = 0.0,
        seed: int = 7,
    ) -> MonteCarloResult:
        frame = self._prepare_frame(candles)
        feature_frame = self._build_features(frame)
        if len(feature_frame) < self.config.min_history:
            raise ValueError(
                f"Monte Carlo requires at least {self.config.min_history} clean observations; "
                f"received {len(feature_frame)}"
            )

        current_date = feature_frame.index[-1]
        current_state = feature_frame.iloc[-1].to_numpy(dtype=np.float64)
        returns = np.log(frame["close"] / frame["close"].shift(1))

        candidates, forward_paths = self._candidate_paths(feature_frame, returns)
        center = candidates.median(axis=0).to_numpy(dtype=np.float64)
        scale = (candidates.quantile(0.75) - candidates.quantile(0.25)).to_numpy(dtype=np.float64)
        scale = np.where(np.abs(scale) < 1e-8, 1.0, scale)
        candidate_matrix = ((candidates.to_numpy(dtype=np.float64) - center) / scale).astype(np.float32)
        query = ((current_state - center) / scale).astype(np.float32)

        neighbor_positions, distances = self._nearest(candidate_matrix, query)
        selected_paths = forward_paths[neighbor_positions]
        weights = self._distance_weights(distances)
        effective_neighbors = float(1.0 / np.sum(np.square(weights)))

        rng = np.random.default_rng(seed)
        simulated_log_returns = self._resample_paths(selected_paths, weights, rng)

        bounded_context = float(np.clip(context_score, -1.0, 1.0))
        total_context_shift = bounded_context * self.config.context_impact_bps / 10_000.0
        simulated_log_returns += total_context_shift / self.config.horizon_days

        cumulative = np.cumsum(simulated_log_returns, axis=1)
        terminal_returns = np.expm1(cumulative[:, -1])
        cumulative_simple = np.expm1(cumulative)
        running_peak = np.maximum.accumulate(cumulative_simple + 1.0, axis=1)
        drawdowns = ((cumulative_simple + 1.0) / running_peak) - 1.0
        path_max_drawdowns = np.min(drawdowns, axis=1)

        result = self._summarize(
            terminal_returns,
            path_max_drawdowns,
            history_size=len(candidates),
            effective_neighbors=effective_neighbors,
        )
        result.diagnostics.update({
            "model": "Regime-conditioned moving-block Monte Carlo",
            "policy_status": "RESEARCH_ONLY",
            "validation_gate": "NOT_PASSED",
            "is_reinforcement_learning": False,
            "feature_names": list(FEATURE_NAMES),
            "current_state": [round(float(value), 6) for value in current_state],
            "data_through": str(current_date),
            "history_observations": len(candidates),
            "neighbors_requested": self.config.neighbor_count,
            "effective_neighbors": round(effective_neighbors, 2),
            "simulations": self.config.simulations,
            "horizon_days": self.config.horizon_days,
            "block_size": self.config.block_size,
            "transaction_cost_bps": self.config.transaction_cost_bps,
            "context_score": round(bounded_context, 4),
            "context_shift_bps": round(total_context_shift * 10_000, 2),
            "seed": int(seed),
        })
        return result

    @staticmethod
    def _prepare_frame(candles: pd.DataFrame) -> pd.DataFrame:
        if candles is None or candles.empty:
            raise ValueError("candles cannot be empty")
        frame = candles.copy()
        frame.columns = [str(column).lower() for column in frame.columns]
        required = {"close", "volume"}
        missing = required.difference(frame.columns)
        if missing:
            raise ValueError(f"candles missing required columns: {sorted(missing)}")
        frame = frame.sort_index()
        frame = frame.loc[~frame.index.duplicated(keep="last")]
        frame["close"] = pd.to_numeric(frame["close"], errors="coerce")
        frame["volume"] = pd.to_numeric(frame["volume"], errors="coerce")
        frame = frame.replace([np.inf, -np.inf], np.nan).dropna(subset=["close"])
        frame = frame[frame["close"] > 0]
        frame["volume"] = frame["volume"].fillna(0).clip(lower=0)
        return frame

    @staticmethod
    def _build_features(frame: pd.DataFrame) -> pd.DataFrame:
        close = frame["close"]
        volume = frame["volume"].replace(0, np.nan)
        log_return = np.log(close / close.shift(1))
        vol20 = log_return.rolling(20).std() * np.sqrt(252)
        vol60 = log_return.rolling(60).std() * np.sqrt(252)
        ema20 = close.ewm(span=20, adjust=False).mean()
        ema60 = close.ewm(span=60, adjust=False).mean()
        volume_median = volume.rolling(20).median()

        features = pd.DataFrame(index=frame.index)
        features["return_1d"] = log_return
        features["return_5d"] = np.log(close / close.shift(5))
        features["momentum_20d"] = (close / close.rolling(20).mean()) - 1.0
        features["trend_20_60d"] = (ema20 / ema60) - 1.0
        features["volatility_20d"] = vol20
        features["volatility_regime"] = np.log(vol20 / vol60)
        features["drawdown_60d"] = (close / close.rolling(60).max()) - 1.0
        features["volume_shock"] = np.log(volume / volume_median)
        return features.replace([np.inf, -np.inf], np.nan).dropna()

    def _candidate_paths(
        self,
        features: pd.DataFrame,
        returns: pd.Series,
    ) -> tuple[pd.DataFrame, np.ndarray]:
        rows: list[np.ndarray] = []
        dates: list[Any] = []
        paths: list[np.ndarray] = []
        return_positions = {date: position for position, date in enumerate(returns.index)}

        # The latest state is the query. Every candidate must have a completely
        # observed forward horizon, which prevents look-ahead leakage.
        for date, row in features.iloc[:-1].iterrows():
            position = return_positions.get(date)
            if position is None:
                continue
            forward = returns.iloc[position + 1: position + 1 + self.config.horizon_days]
            if len(forward) != self.config.horizon_days or forward.isna().any():
                continue
            rows.append(row.to_numpy(dtype=np.float64))
            dates.append(date)
            paths.append(forward.to_numpy(dtype=np.float64))

        if len(rows) < self.config.min_history:
            raise ValueError(
                f"Monte Carlo requires {self.config.min_history} completed historical regimes; "
                f"received {len(rows)}"
            )
        return pd.DataFrame(rows, index=dates, columns=features.columns), np.vstack(paths)

    def _nearest(self, matrix: np.ndarray, query: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        k = min(self.config.neighbor_count, len(matrix))
        if faiss is not None:
            index = faiss.IndexFlatL2(matrix.shape[1])
            index.add(matrix)
            distances, positions = index.search(query.reshape(1, -1), k)
            return positions[0].astype(int), distances[0].astype(np.float64)

        squared_distances = np.sum(np.square(matrix - query), axis=1)
        positions = np.argsort(squared_distances)[:k]
        return positions, squared_distances[positions].astype(np.float64)

    @staticmethod
    def _distance_weights(distances: np.ndarray) -> np.ndarray:
        positive = distances[distances > 1e-12]
        temperature = float(np.median(positive)) if len(positive) else 1.0
        raw = np.exp(-distances / max(temperature, 1e-8))
        if not np.isfinite(raw).all() or raw.sum() <= 0:
            raw = np.ones_like(distances, dtype=np.float64)
        return raw / raw.sum()

    def _resample_paths(
        self,
        source_paths: np.ndarray,
        weights: np.ndarray,
        rng: np.random.Generator,
    ) -> np.ndarray:
        output = np.empty((self.config.simulations, self.config.horizon_days), dtype=np.float64)
        for start in range(0, self.config.horizon_days, self.config.block_size):
            end = min(start + self.config.block_size, self.config.horizon_days)
            choices = rng.choice(len(source_paths), size=self.config.simulations, p=weights)
            output[:, start:end] = source_paths[choices, start:end]
        return output

    def _summarize(
        self,
        terminal_returns: np.ndarray,
        path_max_drawdowns: np.ndarray,
        *,
        history_size: int,
        effective_neighbors: float,
    ) -> MonteCarloResult:
        cost = self.config.transaction_cost_bps / 10_000.0
        p_profit = float(np.mean(terminal_returns > cost))
        p_loss = float(np.mean(terminal_returns < -cost))
        median_return = float(np.median(terminal_returns))

        if p_profit >= self.config.decision_probability and median_return > cost:
            action = "Buy"
            raw_confidence = p_profit
        elif p_loss >= self.config.decision_probability and median_return < -cost:
            action = "Sell"
            raw_confidence = p_loss
        else:
            action = "Hold"
            raw_confidence = 0.5 + max(0.0, self.config.decision_probability - max(p_profit, p_loss))

        history_reliability = min(1.0, history_size / 750.0)
        neighbor_reliability = min(1.0, effective_neighbors / 40.0)
        reliability = np.sqrt(history_reliability * neighbor_reliability)
        confidence = int(round(50.0 + ((raw_confidence * 100.0) - 50.0) * reliability))
        confidence = int(np.clip(confidence, 50, 95))

        p05, p10, p50, p90, p95 = np.quantile(terminal_returns, [0.05, 0.10, 0.50, 0.90, 0.95])
        tail = terminal_returns[terminal_returns <= p05]
        expected_shortfall = float(tail.mean()) if len(tail) else float(p05)

        scenarios = [
            {
                "name": "Downside tail",
                "probability": 10.0,
                "projected_return": round(float(p10) * 100, 2),
                "catalyst": "10th-percentile outcome from historically similar regimes.",
            },
            {
                "name": "Base case",
                "probability": 80.0,
                "projected_return": round(float(p50) * 100, 2),
                "catalyst": "Median path; the central 80% lies between downside and upside tails.",
            },
            {
                "name": "Upside tail",
                "probability": 10.0,
                "projected_return": round(float(p90) * 100, 2),
                "catalyst": "90th-percentile outcome from historically similar regimes.",
            },
        ]

        return MonteCarloResult(
            action=action,
            confidence=confidence,
            expected_return_pct=round(float(np.mean(terminal_returns)) * 100, 2),
            median_return_pct=round(median_return * 100, 2),
            probability_profit_pct=round(p_profit * 100, 1),
            probability_loss_pct=round(p_loss * 100, 1),
            value_at_risk_95_pct=round(float(p05) * 100, 2),
            expected_shortfall_95_pct=round(expected_shortfall * 100, 2),
            expected_max_drawdown_pct=round(float(np.mean(path_max_drawdowns)) * 100, 2),
            scenarios=scenarios,
            diagnostics={
                "upper_tail_95_pct": round(float(p95) * 100, 2),
                "reliability": round(float(reliability), 4),
            },
        )
