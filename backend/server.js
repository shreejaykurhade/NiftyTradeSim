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
const strategyLabRoutes = require('./src/routes/strategyLab');

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
app.use('/api/strategy-lab', strategyLabRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 5000;

async function bootstrap() {
  httpServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is already in use. Another backend server is probably already running.`);
      console.error(`➡️  Use the existing server at http://localhost:${PORT}, or stop it with:`);
      console.error(`   PowerShell: Get-NetTCPConnection -LocalPort ${PORT} | Select-Object -ExpandProperty OwningProcess | Stop-Process -Force`);
      process.exit(1);
    }

    console.error('❌ HTTP server error:', err.message);
    process.exit(1);
  });

  httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });

  try {
    await connectDB();
  } catch (err) {
    console.error('⚠️ MongoDB unavailable. Metadata routes will work, but auth, portfolio, candles, and backtests need MongoDB:', err.message);
    return;
  }

  try {
    try {
      await connectRedis();
      console.log('✅ Redis connected');
    } catch (err) {
      console.error('⚠️ Redis unavailable. API will start, but live prices and trading execution may be limited:', err.message);
    }

    initSocket(httpServer);
    console.log('✅ WebSocket server initialized');

    if (process.env.ENABLE_AUTO_FETCH === 'true') {
      autoFetchMissingData().catch((err) => {
        console.error('⚠️ Historical data auto-fetch failed:', err.message);
      });
    } else {
      console.log('ℹ️ Historical auto-fetch skipped. Set ENABLE_AUTO_FETCH=true to run it on startup.');
    }

    try {
      startMarketFetcher();
      console.log('✅ Market data fetcher started');
    } catch (err) {
      console.error('⚠️ Market data fetcher failed to start:', err.message);
    }
  } catch (err) {
    console.error('❌ Background service bootstrap error:', err.message);
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
