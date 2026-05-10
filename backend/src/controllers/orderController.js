const User = require('../models/User');
const Order = require('../models/Order');
const Holding = require('../models/Holding');
const { redisClient } = require('../config/redis');
const NIFTY_50 = require('../config/stocks');
const { getIO } = require('../websockets/socket');
const {
  BUY,
  SELL,
  normalizeOrderRequest,
  simulateExecution,
  calculateWeightedAverage,
} = require('../../../trading_framework/executionEngine');

const ALLOWED_SYMBOLS = NIFTY_50
  .filter((stock) => stock.sector !== 'Index')
  .map((stock) => stock.symbol.toUpperCase());

async function getOrders(req, res) {
  try {
    const orders = await Order.find({ userId: req.user.userId }).sort({ createdAt: -1 }).limit(100);
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getLiveQuote(stockSymbol) {
  const cached = await redisClient.get(`stock:${stockSymbol}`);
  if (!cached) {
    throw new Error('Live price is not available yet. Wait for the market feed to refresh.');
  }

  const quote = JSON.parse(cached);
  if (!Number.isFinite(Number(quote.price)) || Number(quote.price) <= 0) {
    throw new Error('Live price is invalid. Wait for the market feed to refresh.');
  }

  return quote;
}

function emitOrderExecuted(userId, order) {
  const io = getIO();
  if (!io) return;

  io.to(`user:${userId}`).emit('order_executed', {
    type: order.type,
    orderType: order.orderType,
    symbol: order.stockSymbol,
    stockSymbol: order.stockSymbol,
    quantity: order.quantity,
    price: order.price,
    total: order.total,
  });
}

async function persistBuy({ userId, stockSymbol, execution }) {
  const user = await User.findOneAndUpdate(
    { _id: userId, balance: { $gte: execution.total } },
    { $inc: { balance: -execution.total } },
    { new: true }
  );

  if (!user) {
    throw new Error(`Insufficient balance. Required ₹${execution.total.toFixed(2)}.`);
  }

  let previousHolding = null;
  let createdHolding = false;

  try {
    const holding = await Holding.findOne({ userId, stockSymbol });
    if (holding) {
      previousHolding = holding.toObject();
      holding.avgPrice = calculateWeightedAverage(
        holding.quantity,
        holding.avgPrice,
        execution.quantity,
        execution.executionPrice
      );
      holding.quantity += execution.quantity;
      await holding.save();
    } else {
      createdHolding = true;
      previousHolding = null;
      await Holding.create({
        userId,
        stockSymbol,
        quantity: execution.quantity,
        avgPrice: execution.executionPrice,
      });
    }

    const order = await Order.create({
      userId,
      stockSymbol,
      type: BUY,
      orderType: execution.orderType,
      requestedLimitPrice: execution.requestedLimitPrice,
      price: execution.executionPrice,
      quantity: execution.quantity,
      total: execution.total,
      status: 'EXECUTED',
    });

    return { order, user };
  } catch (err) {
    await User.updateOne({ _id: userId }, { $inc: { balance: execution.total } });
    if (createdHolding) {
      await Holding.deleteOne({ userId, stockSymbol });
    } else if (previousHolding) {
      await Holding.updateOne(
        { _id: previousHolding._id },
        { $set: { quantity: previousHolding.quantity, avgPrice: previousHolding.avgPrice } }
      );
    }
    throw err;
  }
}

async function persistSell({ userId, stockSymbol, execution }) {
  const holding = await Holding.findOne({ userId, stockSymbol });
  if (!holding || holding.quantity < execution.quantity) {
    throw new Error(`Not enough shares to sell. You hold ${holding ? holding.quantity : 0}.`);
  }

  const previousHolding = holding.toObject();
  const remaining = holding.quantity - execution.quantity;
  let credited = false;

  if (remaining === 0) {
    await Holding.deleteOne({ _id: holding._id });
  } else {
    holding.quantity = remaining;
    await holding.save();
  }

  try {
    const user = await User.findByIdAndUpdate(
      userId,
      { $inc: { balance: execution.total } },
      { new: true }
    );
    credited = true;

    const order = await Order.create({
      userId,
      stockSymbol,
      type: SELL,
      orderType: execution.orderType,
      requestedLimitPrice: execution.requestedLimitPrice,
      price: execution.executionPrice,
      quantity: execution.quantity,
      total: execution.total,
      status: 'EXECUTED',
    });

    return { order, user };
  } catch (err) {
    if (credited) {
      await User.updateOne({ _id: userId }, { $inc: { balance: -execution.total } });
    }
    await Holding.findOneAndUpdate(
      { _id: previousHolding._id },
      {
        $set: {
          userId: previousHolding.userId,
          stockSymbol: previousHolding.stockSymbol,
          quantity: previousHolding.quantity,
          avgPrice: previousHolding.avgPrice,
        },
      },
      { upsert: true }
    );
    throw err;
  }
}

async function executePaperOrder(req, res, side) {
  try {
    const request = normalizeOrderRequest({ ...req.body, side }, ALLOWED_SYMBOLS);
    const quote = await getLiveQuote(request.stockSymbol);
    const execution = simulateExecution({
      side: request.side,
      quantity: request.quantity,
      livePrice: quote.price,
      limitPrice: request.limitPrice,
    });

    const result = request.side === BUY
      ? await persistBuy({ userId: req.user.userId, stockSymbol: request.stockSymbol, execution })
      : await persistSell({ userId: req.user.userId, stockSymbol: request.stockSymbol, execution });

    emitOrderExecuted(req.user.userId, result.order);

    res.status(201).json({
      message: `${request.side === BUY ? 'Buy' : 'Sell'} order executed at simulated live price`,
      order: result.order,
      execution: {
        orderType: execution.orderType,
        requestedLimitPrice: execution.requestedLimitPrice,
        executionPrice: execution.executionPrice,
        quantity: execution.quantity,
        total: execution.total,
      },
      balance: result.user?.balance,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function buyStock(req, res) {
  return executePaperOrder(req, res, BUY);
}

async function sellStock(req, res) {
  return executePaperOrder(req, res, SELL);
}

module.exports = { buyStock, sellStock, getOrders };
