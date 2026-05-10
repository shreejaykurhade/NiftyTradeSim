const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { listStrategies, runBacktest } = require('../controllers/strategyLabController');

router.use(authMiddleware);
router.get('/strategies', listStrategies);
router.post('/backtest', runBacktest);

module.exports = router;
