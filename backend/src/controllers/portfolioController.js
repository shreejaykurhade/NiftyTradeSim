const User = require('../models/User');
const Holding = require('../models/Holding');
const { redisClient } = require('../config/redis');
const NIFTY_50 = require('../config/stocks');

const STOCK_META = new Map(NIFTY_50.map((stock) => [stock.symbol, stock]));

async function getCachedQuote(symbol) {
  try {
    if (!redisClient.isOpen) return null;
    const cached = await redisClient.get(`stock:${symbol}`);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

// GET /api/portfolio
async function getPortfolio(req, res) {
  try {
    const user = await User.findById(req.user.userId).select('balance name email -_id');
    
    // Check if user exists otherwise balance fetch might fail
    if (!user) return res.status(404).json({ error: "User not found" });

    const holdings = await Holding.find({ userId: req.user.userId }).lean();

    const enriched = await Promise.all(
      holdings.map(async (h) => {
        const quote = await getCachedQuote(h.stockSymbol);
        const meta = STOCK_META.get(h.stockSymbol) || {};
        const currentPrice = quote?.price || h.avgPrice;
        const currentValue = currentPrice * h.quantity;
        const investedValue = h.avgPrice * h.quantity;
        const pnl = currentValue - investedValue;
        const pnlPct = ((pnl / investedValue) * 100).toFixed(2);

        return {
          ...h,
          name: meta.name || h.stockSymbol,
          sector: meta.sector || 'Other',
          website: meta.website || null,
          currentPrice,
          currentValue,
          investedValue,
          pnl,
          pnlPct: parseFloat(pnlPct),
          dayChange: quote?.change || 0,
          dayChangePct: quote?.changePct || 0,
          volume: quote?.volume || 0,
        };
      })
    );

    const totalInvested = enriched.reduce((sum, h) => sum + h.investedValue, 0);
    const totalCurrent = enriched.reduce((sum, h) => sum + h.currentValue, 0);
    const totalPnl = totalCurrent - totalInvested;
    const netWorth = user.balance + totalCurrent;
    const sectorAllocation = buildAllocation(enriched, 'sector', totalCurrent);
    const holdingAllocation = enriched
      .map((h) => ({
        symbol: h.stockSymbol,
        name: h.name,
        sector: h.sector,
        value: h.currentValue,
        weight: totalCurrent > 0 ? Number(((h.currentValue / totalCurrent) * 100).toFixed(2)) : 0,
        pnl: h.pnl,
        pnlPct: h.pnlPct,
      }))
      .sort((a, b) => b.value - a.value);

    res.json({
      user,
      balance: user.balance,
      holdings: enriched,
      analytics: {
        sectorAllocation,
        holdingAllocation,
        cashWeight: netWorth > 0 ? Number(((user.balance / netWorth) * 100).toFixed(2)) : 0,
        investedWeight: netWorth > 0 ? Number(((totalCurrent / netWorth) * 100).toFixed(2)) : 0,
        topSector: sectorAllocation[0] || null,
        topHolding: holdingAllocation[0] || null,
      },
      summary: {
        totalInvested,
        totalCurrent,
        totalPnl,
        totalPnlPct: totalInvested > 0 ? parseFloat(((totalPnl / totalInvested) * 100).toFixed(2)) : 0,
        netWorth,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function buildAllocation(holdings, field, totalCurrent) {
  const grouped = holdings.reduce((acc, holding) => {
    const key = holding[field] || 'Other';
    acc[key] = acc[key] || { label: key, value: 0, investedValue: 0, pnl: 0, count: 0 };
    acc[key].value += holding.currentValue;
    acc[key].investedValue += holding.investedValue;
    acc[key].pnl += holding.pnl;
    acc[key].count += 1;
    return acc;
  }, {});

  return Object.values(grouped)
    .map((item) => ({
      ...item,
      weight: totalCurrent > 0 ? Number(((item.value / totalCurrent) * 100).toFixed(2)) : 0,
      pnlPct: item.investedValue > 0 ? Number(((item.pnl / item.investedValue) * 100).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.value - a.value);
}

module.exports = { getPortfolio };
