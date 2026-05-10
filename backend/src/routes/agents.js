const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { getAgentConsensus } = require('../controllers/agentController');
const { getAgentMemory } = require('../services/agentMemoryService');

function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ') && process.env.JWT_SECRET) {
    try {
      req.user = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    } catch {
      req.user = null;
    }
  }
  next();
}

// GET /api/agents/simulation/:symbol
router.get('/simulation/:symbol', optionalAuth, getAgentConsensus);
router.get('/memory', optionalAuth, (req, res, next) => {
  req.params.symbol = req.query.symbol;
  return getAgentMemory(req, res, next);
});
router.get('/memory/:symbol', optionalAuth, getAgentMemory);

module.exports = router;
