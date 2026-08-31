const mongoose = require('mongoose');
const YahooFinance = require('yahoo-finance2').default;
const AgentRun = require('../models/AgentRun');

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

function getActorId(req) {
  return req.user?.id || req.user?._id || req.user?.userId || 'guest';
}

function isMongoReady() {
  return mongoose.connection.readyState === 1;
}

function evaluateDecision(action, returnPct) {
  if (action === 'Buy') return returnPct > 0.2;
  if (action === 'Sell') return returnPct < -0.2;
  if (action === 'Hold') return Math.abs(returnPct) <= 0.75;
  return null;
}

function outcomeNote(action, returnPct, correct) {
  const direction = returnPct >= 0 ? 'up' : 'down';
  if (correct) return `${action} call aligned with the next observed move (${direction} ${Math.abs(returnPct).toFixed(2)}%).`;
  return `${action} call did not align with the next observed move (${direction} ${Math.abs(returnPct).toFixed(2)}%).`;
}

async function resolvePendingOutcomes(userId, symbol, currentPrice) {
  if (!isMongoReady() || !currentPrice) return [];

  const pendingRuns = await AgentRun.find({
    userId,
    symbol,
    action: { $in: ['Buy', 'Hold', 'Sell'] },
    referencePrice: { $gt: 0 },
    'outcome.status': 'PENDING',
  }).sort({ createdAt: -1 }).limit(20);

  const evaluated = [];
  for (const run of pendingRuns) {
    if (String(run._id) && Number(run.referencePrice) === Number(currentPrice)) continue;

    const returnPct = ((currentPrice - run.referencePrice) / run.referencePrice) * 100;
    const correct = evaluateDecision(run.action, returnPct);
    run.outcome = {
      status: 'EVALUATED',
      evaluatedAt: new Date(),
      evaluationPrice: currentPrice,
      returnPct,
      correct,
      note: outcomeNote(run.action, returnPct, correct),
    };
    await run.save();
    evaluated.push(run);
  }
  return evaluated;
}

function summarizeRuns(runs) {
  const evaluated = runs.filter((run) => run.outcome?.status === 'EVALUATED' && run.outcome.correct !== null);
  const correct = evaluated.filter((run) => run.outcome.correct).length;
  const accuracy = evaluated.length ? correct / evaluated.length : null;
  const recentMistakes = evaluated.filter((run) => !run.outcome.correct).slice(0, 3);

  let memoryAdjustment = 0;
  if (evaluated.length >= 3) {
    memoryAdjustment = Math.max(-0.12, Math.min(0.12, (accuracy - 0.5) * 0.24));
  }

  return {
    total_runs: runs.length,
    evaluated_runs: evaluated.length,
    accuracy,
    memory_adjustment: memoryAdjustment,
    recent_mistakes: recentMistakes.map((run) => ({
      action: run.action,
      consensus_score: run.consensusScore,
      return_pct: run.outcome.returnPct,
      note: run.outcome.note,
      created_at: run.createdAt,
    })),
    last_runs: runs.slice(0, 5).map((run) => ({
      action: run.action,
      consensus_score: run.consensusScore,
      reference_price: run.referencePrice,
      outcome: run.outcome,
      created_at: run.createdAt,
    })),
  };
}

async function buildMemoryContext({ userId, symbol, currentPrice }) {
  const referencePrice = currentPrice || await fetchReferencePrice(symbol);

  if (!isMongoReady()) {
    return {
      enabled: false,
      total_runs: 0,
      evaluated_runs: 0,
      accuracy: null,
      memory_adjustment: 0,
      recent_mistakes: [],
      last_runs: [],
      note: 'MongoDB is unavailable, so durable agent memory is disabled for this run.',
    };
  }

  await resolvePendingOutcomes(userId, symbol, referencePrice);
  const runs = await AgentRun.find({ userId, symbol, action: { $in: ['Buy', 'Hold', 'Sell'] } })
    .sort({ createdAt: -1 }).limit(30).lean();
  return {
    enabled: true,
    reference_price: referencePrice || null,
    ...summarizeRuns(runs),
  };
}

async function fetchReferencePrice(symbol) {
  try {
    const quote = await yahooFinance.quote(symbol);
    return Number(quote.regularMarketPrice || quote.postMarketPrice || quote.preMarketPrice || 0) || null;
  } catch (err) {
    return null;
  }
}

async function recordAgentRun({ userId, symbol, result, logs, memoryContext }) {
  if (!isMongoReady() || !result || !['Buy', 'Hold', 'Sell'].includes(result.action)) return null;

  return AgentRun.create({
    userId,
    symbol,
    action: result.action || 'Error',
    consensusScore: Number(result.consensus_score || 0),
    reasoning: result.reasoning || '',
    vectors: {
      technical: result.technical_vector || result.vector || [],
      perception: result.perception_vector || [],
      state: result.state_vector || [],
    },
    technicalWeight: Number(result.technical_weight || 0),
    perceptionWeight: Number(result.perception_weight || 0),
    memoryAdjustment: Number(result.memory_adjustment || 0),
    referencePrice: Number(result.reference_price || 0) || null,
    marketDate: result.market_date ? new Date(result.market_date) : null,
    scenarios: result.scenarios || [],
    logs: logs || [],
    memoryContext: memoryContext || {},
  });
}

async function getAgentMemory(req, res) {
  const userId = getActorId(req);
  const symbol = req.params.symbol;

  if (!symbol) {
    return res.status(400).json({ error: 'Symbol is required' });
  }

  if (!isMongoReady()) {
    return res.json({
      enabled: false,
      total_runs: 0,
      evaluated_runs: 0,
      accuracy: null,
      memory_adjustment: 0,
      recent_mistakes: [],
      last_runs: [],
    });
  }

  const runs = await AgentRun.find({ userId, symbol, action: { $in: ['Buy', 'Hold', 'Sell'] } })
    .sort({ createdAt: -1 }).limit(30).lean();
  res.json({ enabled: true, ...summarizeRuns(runs) });
}

module.exports = {
  buildMemoryContext,
  fetchReferencePrice,
  getActorId,
  getAgentMemory,
  recordAgentRun,
};
