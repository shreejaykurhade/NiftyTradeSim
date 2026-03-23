const express = require('express');
const router = express.Router();
const { buyStock, sellStock, getOrders } = require('../controllers/orderController');
const authMiddleware = require('../middleware/auth');
const { tradingLimiter } = require('../middleware/rateLimiter');

router.use(authMiddleware);
router.get('/', getOrders);
router.post('/buy', tradingLimiter, buyStock);
router.post('/sell', tradingLimiter, sellStock);

module.exports = router;
