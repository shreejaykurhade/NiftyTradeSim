const express = require('express');
const router = express.Router();
const { getAgentConsensus } = require('../controllers/agentController');

// GET /api/agents/simulation/:symbol
router.get('/simulation/:symbol', getAgentConsensus);

module.exports = router;
