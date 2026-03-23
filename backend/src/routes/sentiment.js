const express = require('express');
const router = express.Router();
const { getStockSentiment } = require('../services/sentimentService');
const NIFTY_50 = require('../config/stocks');
const { redisClient } = require('../config/redis');

router.get('/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const stockInfo = NIFTY_50.find(s => s.symbol === symbol);

    if (!stockInfo) {
      return res.status(404).json({ error: 'Stock not found' });
    }

    // Check cache first (TTL 1 hour for sentiment)
    const cacheKey = `sentiment:${symbol}`;
    const isRefresh = req.query.refresh === 'true';

    if (!isRefresh) {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return res.json(JSON.parse(cached));
      }
    }

    const sentiment = await getStockSentiment(symbol, stockInfo.name, stockInfo.sector);
    
    // Cache for 1 hour
    await redisClient.setEx(cacheKey, 3600, JSON.stringify(sentiment));

    res.json(sentiment);
  } catch (error) {
    console.error('Sentiment route error:', error);
    // Always return JSON so the frontend can display the error nicely
    res.status(500).json({ 
      error: error.message || 'AI Sentiment Analysis failed. Please try again later.' 
    });
  }
});

module.exports = router;
