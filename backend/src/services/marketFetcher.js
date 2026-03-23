const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();
const { redisClient } = require('../config/redis');
const { getIO } = require('../websockets/socket');
const NIFTY_50 = require('../config/stocks');
const cron = require('node-cron');
const Candle = require('../models/StockCandle');

const SYMBOLS = NIFTY_50.map((s) => s.symbol);

// Internal state: last known price per symbol
const lastPrices = {};

async function fetchAndBroadcast() {
  try {
    const quotes = await yahooFinance.quote(SYMBOLS);
    const list = Array.isArray(quotes) ? quotes : [quotes];

    // Market Open Check: 9:15 AM - 3:30 PM IST Mon-Fri
    const now = new Date();
    // UTC to IST (+5:30)
    const istTime = new Date(now.getTime() + (330 * 60000));
    const istHour = istTime.getUTCHours();
    const istMin = istTime.getUTCMinutes();
    const day = istTime.getUTCDay(); // 0 is Sunday, 1-5 is Mon-Fri
    
    const isWeekday = day >= 1 && day <= 5;
    const isMarketOpen = isWeekday && (
      (istHour === 9 && istMin >= 15) || 
      (istHour > 9 && istHour < 15) || 
      (istHour === 15 && istMin <= 30)
    );

    const updates = [];
    for (const q of list) {
      if (!q || !q.symbol) continue;
      
      const price = q.regularMarketPrice || q.preMarketPrice;
      if (!price) continue;

      const data = {
        symbol: q.symbol,
        price,
        change: parseFloat((q.regularMarketChange || 0).toFixed(2)),
        changePct: parseFloat((q.regularMarketChangePercent || 0).toFixed(2)),
        volume: q.regularMarketVolume || 0,
        open: q.regularMarketOpen || price,
        high: q.regularMarketDayHigh || price,
        low: q.regularMarketDayLow || price,
        prevClose: q.regularMarketPreviousClose || price,
        time: Math.floor(Date.now() / 1000),
        isMarketOpen,
      };

      updates.push(data);
      lastPrices[q.symbol] = data;

      // UPDATE LATEST CANDLE IN DB: Ensure chart is never "stale"
      // We update the daily candle's 'close' with the latest live price
      const todayStart = new Date(istTime);
      todayStart.setUTCHours(0, 0, 0, 0);
      
      await Candle.findOneAndUpdate(
        { symbol: q.symbol, timestamp: { $gte: todayStart } },
        { 
          $set: { close: price },
          $max: { high: data.high },
          $min: { low: data.low }
        },
        { upsert: false } // Only update if today's candle already exists
      ).catch(() => {}); // Silent fail for candle updates
    }

    if (updates.length > 0) {
      const io = getIO();
      if (io) io.emit('market_update', updates);
      
      // Bulk update Redis (v4 multi)
      const multi = redisClient.multi();
      updates.forEach(u => {
        multi.set(`stock:${u.symbol}`, JSON.stringify(u), { EX: 60 });
      });
      await multi.exec();
    }
  } catch (err) {
    console.error('Market fetch failed:', err.message);
  }
}

function startMarketFetcher() {
  // Poll every 10 seconds (User requested) to ensure "Live Accurate" settlement data
  cron.schedule('*/10 * * * * *', async () => {
    await fetchAndBroadcast();
  });
  
  // Initial fetch
  fetchAndBroadcast();
}

function getLastPrice(symbol) {
  return lastPrices[symbol] || null;
}

module.exports = { startMarketFetcher, getLastPrice };
