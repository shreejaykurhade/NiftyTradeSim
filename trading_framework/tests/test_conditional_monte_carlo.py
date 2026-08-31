import numpy as np
import pandas as pd
import pytest

from trading_framework.simulation import ConditionalMonteCarlo, MonteCarloConfig, walk_forward_evaluate


def synthetic_candles(rows: int = 1_100) -> pd.DataFrame:
    rng = np.random.default_rng(12345)
    shocks = rng.normal(0.00025, 0.012, rows)
    # Add persistent volatility regimes so block/resime selection is meaningful.
    shocks[300:450] *= 1.8
    shocks[750:900] *= 0.55
    close = 1_000 * np.exp(np.cumsum(shocks))
    volume = rng.lognormal(mean=15.2, sigma=0.35, size=rows)
    return pd.DataFrame(
        {
            "Open": close * (1 + rng.normal(0, 0.002, rows)),
            "High": close * (1 + np.abs(rng.normal(0.006, 0.003, rows))),
            "Low": close * (1 - np.abs(rng.normal(0.006, 0.003, rows))),
            "Close": close,
            "Volume": volume,
        },
        index=pd.bdate_range("2021-01-01", periods=rows),
    )


def test_simulation_is_deterministic_and_distribution_is_valid():
    engine = ConditionalMonteCarlo(MonteCarloConfig(simulations=1_000, neighbor_count=60))
    first = engine.run(synthetic_candles(), context_score=0.2, seed=99).to_dict()
    second = engine.run(synthetic_candles(), context_score=0.2, seed=99).to_dict()

    assert first == second
    assert first["action"] in {"Buy", "Hold", "Sell"}
    assert 50 <= first["confidence"] <= 95
    assert 0 <= first["probability_profit_pct"] <= 100
    assert 0 <= first["probability_loss_pct"] <= 100
    assert sum(item["probability"] for item in first["scenarios"]) == 100
    assert all(np.isfinite(value) for value in [
        first["expected_return_pct"],
        first["median_return_pct"],
        first["value_at_risk_95_pct"],
        first["expected_shortfall_95_pct"],
        first["expected_max_drawdown_pct"],
    ])


def test_candidate_labels_are_strictly_forward_and_complete():
    config = MonteCarloConfig(simulations=500, neighbor_count=40, horizon_days=10)
    engine = ConditionalMonteCarlo(config)
    frame = engine._prepare_frame(synthetic_candles())
    features = engine._build_features(frame)
    returns = np.log(frame["close"] / frame["close"].shift(1))
    candidates, paths = engine._candidate_paths(features, returns)

    assert paths.shape == (len(candidates), config.horizon_days)
    assert np.isfinite(paths).all()
    assert candidates.index.max() <= returns.index[-config.horizon_days - 1]


def test_context_prior_is_bounded_and_small():
    engine = ConditionalMonteCarlo(MonteCarloConfig(simulations=1_000, neighbor_count=60))
    bearish = engine.run(synthetic_candles(), context_score=-50, seed=11)
    bullish = engine.run(synthetic_candles(), context_score=50, seed=11)

    # Inputs are clipped to [-1, 1], and the full-range influence is only 50 bps.
    assert bearish.diagnostics["context_score"] == -1.0
    assert bullish.diagnostics["context_score"] == 1.0
    assert 0.45 <= bullish.expected_return_pct - bearish.expected_return_pct <= 0.55


def test_insufficient_history_fails_closed():
    engine = ConditionalMonteCarlo(MonteCarloConfig(simulations=500, neighbor_count=40))
    with pytest.raises(ValueError, match="requires at least"):
        engine.run(synthetic_candles(180))


def test_walk_forward_uses_chronological_non_overlapping_windows():
    result = walk_forward_evaluate(
        synthetic_candles(720),
        config=MonteCarloConfig(simulations=500, neighbor_count=40),
        first_train_rows=400,
        step_days=20,
        seed=5,
    )

    assert result["test_windows"] > 10
    assert 0 <= result["three_class_accuracy_pct"] <= 100
    assert 0 <= result["directional_coverage_pct"] <= 100
    assert all(row["decision_date"] < row["outcome_date"] for row in result["records"])
