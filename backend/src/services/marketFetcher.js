const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();
const { redisClient } = require('../config/redis');
const { getIO } = require('../websockets/socket');
const NIFTY_50 = require('../config/stocks');
const cron = require('node-cron');

const SYMBOLS = NIFTY_50.map((s) => s.symbol);

// Internal state: last known price per symbol
const lastPrices = {};

async function fetchAndBroadcast() {
  try {
    const quotes = await yahooFinance.quote(SYMBOLS);
    const io = getIO();
    const updates = [];

    const list = Array.isArray(quotes) ? quotes : [quotes];

    for (const q of list) {
      if (!q || !q.symbol) continue;
      const price = q.regularMarketPrice || q.preMarketPrice;
      if (!price) continue;

      const change = q.regularMarketChange || 0;
      const changePct = q.regularMarketChangePercent || 0;
      const volume = q.regularMarketVolume || 0;
      const open = q.regularMarketOpen || price;
      const high = q.regularMarketDayHigh || price;
      const low = q.regularMarketDayLow || price;
      const prevClose = q.regularMarketPreviousClose || price;

      const data = {
        symbol: q.symbol,
        price,
        change: parseFloat(change.toFixed(2)),
        changePct: parseFloat(changePct.toFixed(2)),
        volume,
        open,
        high,
        low,
        prevClose,
        time: Math.floor(Date.now() / 1000),
      };

      // Cache in Redis (TTL 10 seconds)
      await redisClient.setEx(`stock:${q.symbol}`, 10, JSON.stringify(data));

      lastPrices[q.symbol] = data;
      updates.push(data);
    }

    // Broadcast all updates as a single payload
    if (io && updates.length > 0) {
      io.emit('market_update', updates);
    }
  } catch (err) {
    // Silently fail on network errors to avoid crashing the server
    if (process.env.NODE_ENV === 'development') {
      console.error('Market fetch error:', err.message);
    }
  }
}

function startMarketFetcher() {
  // Fetch every 15 seconds as requested
  cron.schedule('*/15 * * * * *', async () => {
    const now = new Date();
    // Convert to IST (UTC+5:30)
    const istMinutes = now.getUTCHours() * 60 + now.getUTCMinutes() + 330;
    const istHour = Math.floor(istMinutes / 60) % 24;
    const istMin = istMinutes % 60;
    const day = now.getUTCDay();

    const isWeekday = day >= 1 && day <= 5;
    const isMarketHours =
      (istHour === 9 && istMin >= 15) ||
      (istHour > 9 && istHour < 15) ||
      (istHour === 15 && istMin <= 30);

    // Bypass market hours in development to ensure "end-to-end working"
    if ((isWeekday && isMarketHours) || process.env.NODE_ENV === 'development') {
      await fetchAndBroadcast();
    }
  });

  // Initial fetch
  fetchAndBroadcast();
}

function getLastPrice(symbol) {
  return lastPrices[symbol] || null;
}

module.exports = { startMarketFetcher, getLastPrice };
