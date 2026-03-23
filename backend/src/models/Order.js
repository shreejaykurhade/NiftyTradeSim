const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const orderSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  userId: { type: String, ref: 'User', required: true, index: true },
  stockSymbol: { type: String, required: true, index: true },
  type: { type: String, enum: ['BUY', 'SELL'], required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true },
  total: { type: Number, required: true },
  status: { type: String, default: 'EXECUTED' },
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
