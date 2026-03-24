const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();
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

    // HIGH RESOLUTION 1D VIEW: Fetch directly from Yahoo (1-minute intervals)
    if (timeframe === '1D') {
      try {
        const chart = await yahooFinance.chart(symbol, { interval: '1m', period1: '2d' });
        const quotes = chart.quotes.filter(q => q.open && q.close);
        
        const formatted = quotes.map(q => ({
          time: Math.floor(new Date(q.date).getTime() / 1000),
          open: q.open,
          high: q.high,
          low: q.low,
          close: q.close,
          volume: q.volume
        }));

        return res.json({ symbol, timeframe: '1D', count: formatted.length, data: formatted });
      } catch (err) {
        console.error('Yahoo Chart fetch failed:', err.message);
        // Fallback to DB below if YF fails
      }
    }

    // HISTORICAL / AGGREGATED VIEWS: Fetch from DB (Daily candles)
    const baseTimeframe = '1D';
    const rawCandles = await StockCandle.find({ symbol, timeframe: baseTimeframe })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    if (!rawCandles || rawCandles.length === 0) {
      return res.json({ symbol, timeframe, count: 0, data: [] });
    }

    let resultData = rawCandles.map((c) => ({
      time: Math.floor(new Date(c.timestamp).getTime() / 1000),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: Number(c.volume),
      _date: new Date(c.timestamp), // for aggregation
    })).reverse();

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
