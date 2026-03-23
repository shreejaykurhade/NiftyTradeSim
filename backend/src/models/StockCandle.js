const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const stockCandleSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  symbol: { type: String, required: true, index: true },
  timeframe: { type: String, required: true, index: true }, // "1D", "1W", "1M"
  timestamp: { type: Date, required: true, index: true },
  open: { type: Number, required: true },
  high: { type: Number, required: true },
  low: { type: Number, required: true },
  close: { type: Number, required: true },
  volume: { type: Number, required: true },
});

stockCandleSchema.index({ symbol: 1, timeframe: 1, timestamp: 1 }, { unique: true });

module.exports = mongoose.model('StockCandle', stockCandleSchema);
