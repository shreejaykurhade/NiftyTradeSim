# Trading Framework

Reusable paper-trading and quant-simulation framework for the project.

This folder intentionally lives outside `frontend/` and `backend/` so web UI, API execution, backtests, and strategy experiments can share the same assumptions without being coupled to app code.

## Structure

```text
trading_framework/
  backtesting/       Python backtest engine, portfolio accounting, metrics, result models
  core/              Shared Python types such as Candle, Signal, StrategyFunction
  strategies/        Strategy definitions grouped by technique
  executionEngine.js Reusable JS execution rules used by the backend API
  index.js           JS framework entrypoint
```

## Design

- Strategies generate signals only.
- Backtesting owns fills, cash, holdings, fees, equity curve, and metrics.
- Execution rules validate and simulate paper orders.
- Metrics/analyzers stay separate from strategies so experiments remain comparable.
- New quant techniques should be added as new modules under `strategies/`.
- New performance analytics should be added under `backtesting/`.

This mirrors the separation used by mature trading tools: Backtrader separates strategies, indicators, sizers, analyzers, and broker execution; vectorbt builds portfolios from signals; Freqtrade keeps strategy customization separate from backtesting/runtime behavior.

## Execution Rules

- Market orders execute at the latest live quote.
- Limit buy orders execute only when `limitPrice >= livePrice`.
- Limit sell orders execute only when `limitPrice <= livePrice`.
- Marketable limit orders fill at the simulated live quote, not at the user's typed limit.
- Quantity must be a positive whole number.
- Symbols must belong to the supported trading universe.
- Money is rounded to paise precision.

This is a paper-trading simulator, not a real broker. The goal is precise, repeatable investment simulation for testing quant ideas.
