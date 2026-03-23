const User = require('../models/User');
const Holding = require('../models/Holding');
const { redisClient } = require('../config/redis');

// GET /api/portfolio
async function getPortfolio(req, res) {
  try {
    const user = await User.findById(req.user.userId).select('balance name email -_id');
    
    // Check if user exists otherwise balance fetch might fail
    if (!user) return res.status(404).json({ error: "User not found" });

    const holdings = await Holding.find({ userId: req.user.userId }).lean();

    // Enrich holdings with current live price from Redis
    const enriched = await Promise.all(
      holdings.map(async (h) => {
        const cached = await redisClient.get(`stock:${h.stockSymbol}`);
        const currentPrice = cached ? JSON.parse(cached).price : h.avgPrice;
        const currentValue = currentPrice * h.quantity;
        const investedValue = h.avgPrice * h.quantity;
        const pnl = currentValue - investedValue;
        const pnlPct = ((pnl / investedValue) * 100).toFixed(2);

        return {
          ...h,
          currentPrice,
          currentValue,
          investedValue,
          pnl,
          pnlPct: parseFloat(pnlPct),
        };
      })
    );

    const totalInvested = enriched.reduce((sum, h) => sum + h.investedValue, 0);
    const totalCurrent = enriched.reduce((sum, h) => sum + h.currentValue, 0);
    const totalPnl = totalCurrent - totalInvested;

    res.json({
      user,
      balance: user.balance,
      holdings: enriched,
      summary: {
        totalInvested,
        totalCurrent,
        totalPnl,
        totalPnlPct: totalInvested > 0 ? parseFloat(((totalPnl / totalInvested) * 100).toFixed(2)) : 0,
        netWorth: user.balance + totalCurrent,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getPortfolio };
