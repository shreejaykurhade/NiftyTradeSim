const express = require('express');
const router = express.Router();
const { getAllStocks, getStock } = require('../controllers/marketController');

router.get('/stocks', getAllStocks);
router.get('/stocks/:symbol', getStock);

module.exports = router;
