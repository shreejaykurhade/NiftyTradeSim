const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const holdingSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  userId: { type: String, ref: 'User', required: true, index: true },
  stockSymbol: { type: String, required: true },
  quantity: { type: Number, required: true },
  avgPrice: { type: Number, required: true },
}, { timestamps: true });

holdingSchema.index({ userId: 1, stockSymbol: 1 }, { unique: true });

module.exports = mongoose.model('Holding', holdingSchema);
