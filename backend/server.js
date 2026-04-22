require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const { initSocket } = require('./src/websockets/socket');
const { startMarketFetcher } = require('./src/services/marketFetcher');
const { autoFetchMissingData } = require('./src/services/autoFetcher');
const { connectRedis } = require('./src/config/redis');
const { connectDB } = require('./src/config/db');

// Routes
const authRoutes = require('./src/routes/auth');
const marketRoutes = require('./src/routes/market');
const orderRoutes = require('./src/routes/orders');
const portfolioRoutes = require('./src/routes/portfolio');
const candleRoutes = require('./src/routes/candles');
const sentimentRoutes = require('./src/routes/sentiment');

const app = express();
const httpServer = http.createServer(app);

// Middleware
app.use(helmet());
app.use(cors({
  origin: [process.env.CLIENT_URL, 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'].filter(Boolean),
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/candles', candleRoutes);
app.use('/api/sentiment', sentimentRoutes);
app.use('/api/agents', require('./src/routes/agents'));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 5000;

async function bootstrap() {
  try {
    // Init DB
    await connectDB();

    // Init Redis
    await connectRedis();
    console.log('✅ Redis connected');

    // Init WebSocket on the same HTTP server
    initSocket(httpServer);
    console.log('✅ WebSocket server initialized');

    // Auto fetch missing historical data
    await autoFetchMissingData();

    // Start live market data fetcher (polls every 2s during market hours)
    startMarketFetcher();
    console.log('✅ Market data fetcher started');

    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('❌ Bootstrap error:', err.message);
    console.error('➡️  Ensure MongoDB is running and MONGO_URI is correct in .env');
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  console.log('🛑 Shutting down server');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Shutting down server');
  process.exit(0);
});

bootstrap();
