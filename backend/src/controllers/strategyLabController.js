const { spawn } = require('child_process');
const path = require('path');
const StockCandle = require('../models/StockCandle');
const NIFTY_50 = require('../config/stocks');
const { redisClient } = require('../config/redis');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const RUNNER_PATH = path.join(PROJECT_ROOT, 'trading_framework', 'runner.py');
const STRATEGIES = {
  buy_and_hold: {
    label: 'Buy and Hold',
    family: 'Passive',
    description: 'Invests once at the first candle and holds through the full period.',
    params: {},
  },
  moving_average_crossover: {
    label: 'Moving Average Crossover',
    family: 'Trend',
    description: 'Buys when short moving average crosses above long moving average; sells on bearish cross.',
    params: { short_window: 20, long_window: 50 },
  },
  rsi_mean_reversion: {
    label: 'RSI Mean Reversion',
    family: 'Mean Reversion',
    description: 'Buys oversold RSI and exits when RSI recovers above the configured threshold.',
    params: { period: 14, buy_below: 30, sell_above: 60 },
  },
  breakout_momentum: {
    label: 'Breakout Momentum',
    family: 'Momentum',
    description: 'Buys upside breakouts and exits when price breaks below a shorter low channel.',
    params: { lookback: 20, exit_lookback: 10 },
  },
};

function getPythonCommand() {
  return process.env.PYTHON_BIN || 'python';
}

function normalizeParams(strategyKey, params = {}) {
  const defaults = STRATEGIES[strategyKey]?.params || {};
  return Object.fromEntries(
    Object.entries({ ...defaults, ...params }).map(([key, value]) => [key, Number(value)])
  );
}

async function listStrategies(req, res) {
  const symbols = await Promise.all(
    NIFTY_50
      .filter((stock) => stock.sector !== 'Index')
      .map(async (stock) => {
        let quote = {};
        try {
          if (redisClient.isOpen) {
            const cached = await redisClient.get(`stock:${stock.symbol}`);
            quote = cached ? JSON.parse(cached) : {};
          }
        } catch {
          quote = {};
        }

        return {
          symbol: stock.symbol,
          name: stock.name,
          sector: stock.sector,
          website: stock.website,
          price: quote.price || null,
          change: quote.change || null,
          changePct: quote.changePct || null,
          open: quote.open || null,
          high: quote.high || null,
          low: quote.low || null,
          volume: quote.volume || null,
          isMarketOpen: Boolean(quote.isMarketOpen),
        };
      })
  );

  res.json({ strategies: STRATEGIES, symbols });
}

async function runBacktest(req, res) {
  try {
    const {
      symbol,
      strategy = 'buy_and_hold',
      startingCash = 1000000,
      positionSizePct = 1,
      feeRate = 0,
      params = {},
      limit = 1250,
    } = req.body;

    if (!STRATEGIES[strategy]) return res.status(400).json({ error: 'Unsupported strategy' });
    if (!NIFTY_50.some((stock) => stock.symbol === symbol && stock.sector !== 'Index')) {
      return res.status(400).json({ error: 'Unsupported stock symbol' });
    }

    const candles = await StockCandle.find({ symbol, timeframe: '1D' })
      .sort({ timestamp: -1 })
      .limit(Math.min(Number(limit) || 1250, 5000))
      .lean();

    const data = candles
      .reverse()
      .map((candle) => ({
        time: Math.floor(new Date(candle.timestamp).getTime() / 1000),
        open: Number(candle.open),
        high: Number(candle.high),
        low: Number(candle.low),
        close: Number(candle.close),
        volume: Number(candle.volume || 0),
      }))
      .filter((candle) => [candle.open, candle.high, candle.low, candle.close].every(Number.isFinite));

    if (data.length < 30) return res.status(400).json({ error: 'Not enough historical candles for backtest' });

    const result = await runPythonBacktest({
      candles: data,
      strategy,
      startingCash: Number(startingCash),
      positionSizePct: Number(positionSizePct),
      feeRate: Number(feeRate),
      params: normalizeParams(strategy, params),
    });

    res.json({
      symbol,
      strategy,
      strategyMeta: STRATEGIES[strategy],
      candleCount: data.length,
      dateRange: {
        from: data[0].time,
        to: data[data.length - 1].time,
      },
      ...result,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function runPythonBacktest({ candles, strategy, startingCash, positionSizePct, feeRate, params }) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const child = spawn(getPythonCommand(), [
      RUNNER_PATH,
      '--strategy', strategy,
      '--starting-cash', String(startingCash),
      '--position-size-pct', String(positionSizePct),
      '--fee-rate', String(feeRate),
      '--params', JSON.stringify(params),
    ], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, PYTHONPATH: PROJECT_ROOT, PYTHONDONTWRITEBYTECODE: '1' },
    });

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGTERM');
      reject(new Error('Backtest runner timed out. Try fewer candles or simpler parameters.'));
    }, 30000);

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(err);
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(stderr || `Backtest runner exited with code ${code}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (err) {
        reject(new Error(`Failed to parse backtest output: ${err.message}`));
      }
    });

    child.stdin.write(JSON.stringify({ candles }));
    child.stdin.end();
  });
}

module.exports = { listStrategies, runBacktest };
