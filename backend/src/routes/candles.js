const express = require('express');
const router = express.Router();
const { getCandles } = require('../controllers/candleController');

// Public endpoint — no auth needed for candle data
router.get('/:symbol', getCandles);

module.exports = router;
