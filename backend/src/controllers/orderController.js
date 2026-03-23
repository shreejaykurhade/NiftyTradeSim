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
  const { stockSymbol, quantity } = req.body;
  if (!stockSymbol || !quantity || quantity <= 0)
    return res.status(400).json({ error: 'Invalid stock symbol or quantity' });

  try {
    const cached = await redisClient.get(`stock:${stockSymbol}`);
    if (!cached)
      return res.status(400).json({ error: 'Price not available, market may be closed' });

    const { price } = JSON.parse(cached);
    const total = price * quantity;

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const user = await User.findById(req.user.userId).session(session);
      if (user.balance < total)
        throw new Error(`Insufficient balance. Need ₹${total.toFixed(2)}, have ₹${user.balance.toFixed(2)}`);

      user.balance -= total;
      await user.save({ session });

      const order = await Order.create([{
        userId: req.user.userId,
        stockSymbol,
        type: 'BUY',
        price,
        quantity,
        total,
        status: 'EXECUTED',
      }], { session });

      const existing = await Holding.findOne({ userId: req.user.userId, stockSymbol }).session(session);

      if (existing) {
        const newQty = existing.quantity + quantity;
        const newAvg = (existing.avgPrice * existing.quantity + price * quantity) / newQty;
        existing.quantity = newQty;
        existing.avgPrice = newAvg;
        await existing.save({ session });
      } else {
        await Holding.create([{
          userId: req.user.userId,
          stockSymbol,
          quantity,
          avgPrice: price,
        }], { session });
      }

      await session.commitTransaction();
      
      // Notify client via WebSocket for instant UI refresh
      const io = require('../websockets/socket').getIO();
      if (io) {
        io.to(`user:${req.user.userId}`).emit('order_executed', {
          type: 'BUY',
          symbol: stockSymbol,
          quantity,
          price
        });
      }

      res.status(201).json({ message: 'Buy order executed', order: order[0] });
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// POST /api/orders/sell
async function sellStock(req, res) {
  const { stockSymbol, quantity } = req.body;
  if (!stockSymbol || !quantity || quantity <= 0)
    return res.status(400).json({ error: 'Invalid stock symbol or quantity' });

  try {
    const cached = await redisClient.get(`stock:${stockSymbol}`);
    if (!cached)
      return res.status(400).json({ error: 'Price not available' });

    const { price } = JSON.parse(cached);
    const total = price * quantity;

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const holding = await Holding.findOne({ userId: req.user.userId, stockSymbol }).session(session);

      if (!holding || holding.quantity < quantity)
        throw new Error(`Not enough shares to sell. You hold ${holding ? holding.quantity : 0}`);

      const user = await User.findById(req.user.userId).session(session);
      user.balance += total;
      await user.save({ session });

      const order = await Order.create([{
        userId: req.user.userId,
        stockSymbol,
        type: 'SELL',
        price,
        quantity,
        total,
        status: 'EXECUTED',
      }], { session });

      const remaining = holding.quantity - quantity;
      if (remaining === 0) {
        await Holding.deleteOne({ _id: holding._id }).session(session);
      } else {
        holding.quantity = remaining;
        await holding.save({ session });
      }

      await session.commitTransaction();

      // Notify client via WebSocket for instant UI refresh
      const io = require('../websockets/socket').getIO();
      if (io) {
        io.to(`user:${req.user.userId}`).emit('order_executed', {
          type: 'SELL',
          symbol: stockSymbol,
          quantity,
          price
        });
      }

      res.status(201).json({ message: 'Sell order executed', order: order[0] });
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { buyStock, sellStock, getOrders };
