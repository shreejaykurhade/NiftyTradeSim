const { redisClient } = require('../config/redis');
const NIFTY_50 = require('../config/stocks');

// GET /api/market/stocks — list all NIFTY 50 with latest cached price
async function getAllStocks(req, res) {
  try {
    const results = await Promise.all(
      NIFTY_50.map(async (stock) => {
        const cached = await redisClient.get(`stock:${stock.symbol}`);
        const priceData = cached ? JSON.parse(cached) : { price: 0, change: 0, pChange: 0 };
        return { ...stock, ...priceData };
      })
    );
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/market/stocks/:symbol — single stock detail
async function getStock(req, res) {
  try {
    const { symbol } = req.params;
    const stock = NIFTY_50.find((s) => s.symbol === symbol);
    if (!stock) return res.status(404).json({ error: 'Invalid NIFTY 50 symbol' });

    const cached = await redisClient.get(`stock:${symbol}`);
    const priceData = cached ? JSON.parse(cached) : { price: 0, change: 0, pChange: 0, timestamp: new Date() };
    
    res.json({ ...stock, ...priceData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getAllStocks, getStock };
