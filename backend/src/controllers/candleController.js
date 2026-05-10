const StockCandle = require('../models/StockCandle');

const VALID_TIMEFRAMES = ['1D', '1W', '1M'];

// GET /api/candles/:symbol?timeframe=1D&limit=15000
async function getCandles(req, res) {
  try {
    const { symbol } = req.params;
    let timeframe = req.query.timeframe || '1D';
    const limit = Math.min(parseInt(req.query.limit) || 10000, 20000);

    if (!VALID_TIMEFRAMES.includes(timeframe)) {
      return res.status(400).json({ error: `Invalid timeframe. Use: ${VALID_TIMEFRAMES.join(', ')}` });
    }

    // Historical views are built from stored daily candles so frontend range
    // controls (1M, 6M, 1Y, ALL) always have enough data to work with.
    const baseTimeframe = '1D';
    const rawCandles = await StockCandle.find({ symbol, timeframe: baseTimeframe })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    if (!rawCandles || rawCandles.length === 0) {
      return res.json({ symbol, timeframe, count: 0, data: [] });
    }

    let resultData = rawCandles
      .map((c) => {
        const open = Number(c.open);
        const high = Number(c.high);
        const low = Number(c.low);
        const close = Number(c.close);
        const timestamp = new Date(c.timestamp);

        if (![open, high, low, close].every(Number.isFinite) || Number.isNaN(timestamp.getTime())) {
          return null;
        }

        return {
          time: Math.floor(timestamp.getTime() / 1000),
          open,
          high: Math.max(open, high, low, close),
          low: Math.min(open, high, low, close),
          close,
          volume: Number(c.volume || 0),
          _date: timestamp,
        };
      })
      .filter(Boolean)
      .reverse();

    // Perform aggregation if timeframe is not 1D
    if (timeframe === '1W' || timeframe === '1M') {
      const grouped = [];
      let currentGroup = null;

      resultData.forEach((candle) => {
        const date = candle._date;
        let groupKey;
        
        if (timeframe === '1W') {
          // Group by ISO week (Year-Week)
          const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
          d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
          const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
          const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
          groupKey = `${d.getUTCFullYear()}-W${weekNo}`;
        } else {
          // Group by Month (Year-Month)
          groupKey = `${date.getFullYear()}-${date.getMonth()}`;
        }

        if (!currentGroup || currentGroup.key !== groupKey) {
          if (currentGroup) grouped.push(currentGroup.data);
          currentGroup = {
            key: groupKey,
            data: {
              time: candle.time, // First candle of the group sets the time
              open: candle.open,
              high: candle.high,
              low: candle.low,
              close: candle.close,
              volume: candle.volume,
            }
          };
        } else {
          currentGroup.data.high = Math.max(currentGroup.data.high, candle.high);
          currentGroup.data.low = Math.min(currentGroup.data.low, candle.low);
          currentGroup.data.close = candle.close; // Last candle's close
          currentGroup.data.volume += candle.volume;
        }
      });
      if (currentGroup) grouped.push(currentGroup.data);
      resultData = grouped;
    }

    // Strip internal _date before sending
    const finalData = resultData.map(({ _date, ...rest }) => rest);

    res.json({ symbol, timeframe, count: finalData.length, data: finalData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getCandles };
