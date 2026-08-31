"""Chronological out-of-sample evaluation for the Monte Carlo policy."""

from __future__ import annotations

from dataclasses import replace

import numpy as np
import pandas as pd

from .conditional_monte_carlo import ConditionalMonteCarlo, MonteCarloConfig


def walk_forward_evaluate(
    candles: pd.DataFrame,
    *,
    config: MonteCarloConfig | None = None,
    first_train_rows: int = 500,
    step_days: int | None = None,
    seed: int = 17,
) -> dict:
    """Evaluate frozen policy rules on successive unseen, non-overlapping horizons.

    Every inference receives only data available at its decision timestamp. The
    following horizon is used exactly once as the out-of-sample label.
    """

    config = config or MonteCarloConfig(simulations=500)
    if config.simulations < 500:
        config = replace(config, simulations=500)
    engine = ConditionalMonteCarlo(config)
    frame = engine._prepare_frame(candles)
    step = step_days or config.horizon_days
    if first_train_rows < config.min_history + 80:
        raise ValueError("first_train_rows is too small for feature warm-up and completed labels")
    if len(frame) < first_train_rows + config.horizon_days:
        raise ValueError("not enough rows for a walk-forward test window")

    cost = config.transaction_cost_bps / 10_000.0
    records = []
    position = 0.0
    for decision_pos in range(first_train_rows - 1, len(frame) - config.horizon_days, step):
        train = frame.iloc[: decision_pos + 1]
        result = engine.run(train, seed=seed + decision_pos)
        start_price = float(frame["close"].iloc[decision_pos])
        end_price = float(frame["close"].iloc[decision_pos + config.horizon_days])
        realized = (end_price / start_price) - 1.0
        actual = "Buy" if realized > cost else "Sell" if realized < -cost else "Hold"
        position_before = position
        if result.action == "Buy":
            position = 1.0
        elif result.action == "Sell":
            position = 0.0
        turnover = abs(position - position_before)
        net_return = (position * realized) - (turnover * cost)
        records.append({
            "decision_date": str(frame.index[decision_pos]),
            "outcome_date": str(frame.index[decision_pos + config.horizon_days]),
            "predicted": result.action,
            "actual": actual,
            "confidence": result.confidence,
            "position_before": int(position_before),
            "position_after": int(position),
            "realized_return_pct": round(realized * 100, 4),
            "policy_return_pct": round(net_return * 100, 4),
            "correct": result.action == actual,
        })

    policy_returns = np.array([row["policy_return_pct"] / 100.0 for row in records])
    equity = np.cumprod(1.0 + policy_returns)
    peaks = np.maximum.accumulate(equity)
    drawdowns = (equity / peaks) - 1.0
    directional = [row for row in records if row["predicted"] != "Hold"]
    buy_hold = (float(frame["close"].iloc[-1]) / float(frame["close"].iloc[first_train_rows - 1])) - 1.0

    return {
        "method": "expanding-window, non-overlapping walk-forward",
        "horizon_days": config.horizon_days,
        "test_windows": len(records),
        "three_class_accuracy_pct": round(np.mean([row["correct"] for row in records]) * 100, 2),
        "directional_coverage_pct": round(len(directional) / len(records) * 100, 2),
        "directional_accuracy_pct": round(
            (np.mean([row["correct"] for row in directional]) * 100) if directional else 0.0,
            2,
        ),
        "position_changes": int(sum(row["position_before"] != row["position_after"] for row in records)),
        "invested_windows_pct": round(np.mean([row["position_after"] for row in records]) * 100, 2),
        "cumulative_policy_return_pct": round((equity[-1] - 1.0) * 100, 2),
        "buy_hold_return_pct": round(buy_hold * 100, 2),
        "max_drawdown_pct": round(float(drawdowns.min()) * 100, 2),
        "average_confidence": round(np.mean([row["confidence"] for row in records]), 2),
        "records": records,
    }
