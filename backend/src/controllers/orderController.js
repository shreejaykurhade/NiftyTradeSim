const mongoose = require('mongoose');
const User = require('../models/User');
const Order = require('../models/Order');
const Holding = require('../models/Holding');
const { redisClient } = require('../config/redis');

// GET /api/orders
async function getOrders(req, res) {
  try {
    const orders = await Order.find({ userId: req.user.userId }).sort({ createdAt: -1 }).limit(100);
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/orders/buy
async function buyStock(req, res) {
  const { stockSymbol, quantity, limitPrice } = req.body;
  if (!stockSymbol || !quantity || quantity <= 0)
    return res.status(400).json({ error: 'Invalid stock symbol or quantity' });

  try {
    const cached = await redisClient.get(`stock:${stockSymbol}`);
    if (!cached)
      return res.status(400).json({ error: 'Price not available, market may be closed' });

    const { price: livePrice } = JSON.parse(cached);
    
    // Use limitPrice if provided, otherwise use livePrice
    const executionPrice = limitPrice || livePrice;
    
    // PRICE RANGE VALIDATION: Allow up to 5% deviation from live price for "Limit Orders"
    const deviation = Math.abs(executionPrice - livePrice) / livePrice;
    if (limitPrice && deviation > 0.05) {
      return res.status(400).json({ 
        error: `Limit price out of allowed range (+/- 5%). Live: ₹${livePrice.toFixed(2)}, Allowed: ₹${(livePrice * 0.95).toFixed(2)} - ₹${(livePrice * 1.05).toFixed(2)}` 
      });
    }

    const total = executionPrice * quantity;

    console.log(`📡 [Trade] Attempting BUY for ${stockSymbol}...`);
    try {
      const user = await User.findById(req.user.userId);
      if (!user) throw new Error("User not found");

      if (user.balance < total)
        throw new Error(`Insufficient balance. Need ₹${total.toFixed(2)}, have ₹${user.balance.toFixed(2)}`);

      user.balance -= total;
      await user.save();

      const order = await Order.create({
        userId: req.user.userId,
        stockSymbol,
        type: 'BUY',
        price: executionPrice,
        quantity,
        total,
        status: 'EXECUTED',
      });

      const existing = await Holding.findOne({ userId: req.user.userId, stockSymbol });

      if (existing) {
        const newQty = existing.quantity + quantity;
        const newAvg = (existing.avgPrice * existing.quantity + executionPrice * quantity) / newQty;
        existing.quantity = newQty;
        existing.avgPrice = newAvg;
        await existing.save();
      } else {
        await Holding.create({
          userId: req.user.userId,
          stockSymbol,
          quantity,
          avgPrice: executionPrice,
        });
      }

      console.log(`✅ [Trade] BUY executed successfully for ${stockSymbol}`);
      
      const io = require('../websockets/socket').getIO();
      if (io) {
        io.to(`user:${req.user.userId}`).emit('order_executed', {
          type: 'BUY',
          symbol: stockSymbol,
          quantity,
          price: executionPrice
        });
      }

      res.status(201).json({ message: 'Buy order executed', order });
    } catch (err) {
      console.error(`❌ [Trade] BUY failed:`, err.message);
      throw err;
    }
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// POST /api/orders/sell
async function sellStock(req, res) {
  const { stockSymbol, quantity, limitPrice } = req.body;
  if (!stockSymbol || !quantity || quantity <= 0)
    return res.status(400).json({ error: 'Invalid stock symbol or quantity' });

  try {
    const cached = await redisClient.get(`stock:${stockSymbol}`);
    if (!cached)
      return res.status(400).json({ error: 'Price not available' });

    const { price: livePrice } = JSON.parse(cached);
    const executionPrice = limitPrice || livePrice;

    // PRICE RANGE VALIDATION: Allow up to 5% deviation
    const deviation = Math.abs(executionPrice - livePrice) / livePrice;
    if (limitPrice && deviation > 0.05) {
      return res.status(400).json({ 
        error: `Limit price out of allowed range (+/- 5%). Live: ₹${livePrice.toFixed(2)}` 
      });
    }

    const total = executionPrice * quantity;

    console.log(`📡 [Trade] Attempting SELL for ${stockSymbol}...`);
    try {
      const holding = await Holding.findOne({ userId: req.user.userId, stockSymbol });

      if (!holding || holding.quantity < quantity)
        throw new Error(`Not enough shares to sell. You hold ${holding ? holding.quantity : 0}`);

      const user = await User.findById(req.user.userId);
      if (!user) throw new Error("User not found");

      user.balance += total;
      await user.save();

      const order = await Order.create({
        userId: req.user.userId,
        stockSymbol,
        type: 'SELL',
        price: executionPrice,
        quantity,
        total,
        status: 'EXECUTED',
      });

      const remaining = holding.quantity - quantity;
      if (remaining === 0) {
        await Holding.deleteOne({ _id: holding._id });
      } else {
        holding.quantity = remaining;
        await holding.save();
      }

      console.log(`✅ [Trade] SELL executed successfully for ${stockSymbol}`);

      const io = require('../websockets/socket').getIO();
      if (io) {
        io.to(`user:${req.user.userId}`).emit('order_executed', {
          type: 'SELL',
          symbol: stockSymbol,
          quantity,
          price: executionPrice
        });
      }

      res.status(201).json({ message: 'Sell order executed', order });
    } catch (err) {
      console.error(`❌ [Trade] SELL failed:`, err.message);
      throw err;
    }
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { buyStock, sellStock, getOrders };
