const StockCandle = require('../models/StockCandle');

const VALID_TIMEFRAMES = ['1D', '1W', '1M'];

// GET /api/candles/:symbol?timeframe=1D&limit=500
async function getCandles(req, res) {
  try {
    const { symbol } = req.params;
    const timeframe = req.query.timeframe || '1D';
    const limit = Math.min(parseInt(req.query.limit) || 1000, 5000);

    if (!VALID_TIMEFRAMES.includes(timeframe)) {
      return res.status(400).json({ error: `Invalid timeframe. Use: ${VALID_TIMEFRAMES.join(', ')}` });
    }

    const candles = await StockCandle.find({ symbol, timeframe })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    // Reverse to get chronological order for chart consumption
    const data = candles.reverse().map((c) => ({
      time: Math.floor(new Date(c.timestamp).getTime() / 1000),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: Number(c.volume),
    }));

    res.json({ symbol, timeframe, count: data.length, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getCandles };
