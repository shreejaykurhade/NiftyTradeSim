const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const vectorSchema = new mongoose.Schema({
  technical: { type: [Number], default: [] },
  perception: { type: [Number], default: [] },
  state: { type: [Number], default: [] },
}, { _id: false });

const agentRunSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  userId: { type: String, default: 'guest', index: true },
  symbol: { type: String, required: true, index: true },
  action: { type: String, enum: ['Buy', 'Hold', 'Sell', 'Error'], required: true },
  consensusScore: { type: Number, default: 0 },
  reasoning: { type: String, default: '' },
  vectors: { type: vectorSchema, default: () => ({}) },
  technicalWeight: { type: Number, default: 0 },
  perceptionWeight: { type: Number, default: 0 },
  memoryAdjustment: { type: Number, default: 0 },
  referencePrice: { type: Number, default: null },
  marketDate: { type: Date, default: null },
  scenarios: { type: Array, default: [] },
  logs: { type: Array, default: [] },
  memoryContext: { type: Object, default: {} },
  outcome: {
    status: { type: String, enum: ['PENDING', 'EVALUATED'], default: 'PENDING' },
    evaluatedAt: { type: Date, default: null },
    evaluationPrice: { type: Number, default: null },
    returnPct: { type: Number, default: null },
    correct: { type: Boolean, default: null },
    note: { type: String, default: '' },
  },
}, { timestamps: true });

agentRunSchema.index({ userId: 1, symbol: 1, createdAt: -1 });

module.exports = mongoose.model('AgentRun', agentRunSchema);
